package com.ftm.app.portfolio.service;

import com.ftm.app.domain.Holding;
import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import com.ftm.app.portfolio.repository.HoldingRepository;
import com.ftm.app.portfolio.repository.PortfolioSnapshotRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class HoldingPriceService {

  private static final Logger log = LoggerFactory.getLogger(HoldingPriceService.class);
  private static final String DEXUSEU = "DEXUSEU";
  private static final String PRICE_SOURCE_YAHOO = "yahoo_finance";
  // System-default rates used only on the very first startup before any rate has been recorded.
  // Once the DB has a recorded rate (via fx_rates_history), those are used as the fallback instead.
  private static final BigDecimal SYSTEM_DEFAULT_USD_PER_EUR = new BigDecimal("1.08");
  private static final BigDecimal SYSTEM_DEFAULT_GBP_USD = new BigDecimal("1.27");
  private static final BigDecimal SYSTEM_DEFAULT_SEK_USD = new BigDecimal("0.092");
  private static final String GBPUSD_TICKER = "GBPUSD=X";
  private static final String SEKUSD_TICKER = "SEKUSD=X";

  private final HoldingRepository holdingRepository;
  private final YahooFinanceClient yahooFinanceClient;
  private final FredClient fredClient;
  private final PortfolioSnapshotRepository snapshotRepository;

  public HoldingPriceService(
      HoldingRepository holdingRepository,
      YahooFinanceClient yahooFinanceClient,
      FredClient fredClient,
      PortfolioSnapshotRepository snapshotRepository) {
    this.holdingRepository = holdingRepository;
    this.yahooFinanceClient = yahooFinanceClient;
    this.fredClient = fredClient;
    this.snapshotRepository = snapshotRepository;
  }

  @Cacheable("fx-rate-usd-per-eur")
  public BigDecimal fetchUsdPerEurRate() {
    try {
      LocalDate today = LocalDate.now();
      LocalDate from = today.minusDays(7);
      var observations = fredClient.fetchObservations(DEXUSEU, from, today);
      if (!observations.isEmpty()) {
        BigDecimal rate = new BigDecimal(observations.getLast().value());
        log.info("USD/EUR rate from FRED: {}", rate);
        return rate;
      }
    } catch (Exception e) {
      log.warn("Could not fetch USD/EUR rate from FRED, will try DB history: {}", e.getMessage());
    }
    return lastRecordedOrDefault("USD_PER_EUR", SYSTEM_DEFAULT_USD_PER_EUR);
  }

  @Cacheable("fx-rate-gbp-usd")
  public BigDecimal fetchGbpUsdRate() {
    try {
      LocalDate today = LocalDate.now();
      LocalDate from = today.minusDays(7);
      Optional<BigDecimal> live = fetchLatestClose(GBPUSD_TICKER, from, today);
      if (live.isPresent()) return live.get();
    } catch (Exception e) {
      log.warn("Could not fetch GBP/USD rate, will try DB history: {}", e.getMessage());
    }
    return lastRecordedOrDefault("GBP_USD", SYSTEM_DEFAULT_GBP_USD);
  }

  @Cacheable("fx-rate-sek-usd")
  public BigDecimal fetchSekUsdRate() {
    try {
      LocalDate today = LocalDate.now();
      LocalDate from = today.minusDays(7);
      Optional<BigDecimal> live = fetchLatestClose(SEKUSD_TICKER, from, today);
      if (live.isPresent()) return live.get();
    } catch (Exception e) {
      log.warn("Could not fetch SEK/USD rate, will try DB history: {}", e.getMessage());
    }
    return lastRecordedOrDefault("SEK_USD", SYSTEM_DEFAULT_SEK_USD);
  }

  private BigDecimal lastRecordedOrDefault(String currencyPair, BigDecimal systemDefault) {
    try {
      return snapshotRepository
          .findLastFxRate(currencyPair)
          .map(
              rate -> {
                log.info("Using last recorded DB rate for {}: {}", currencyPair, rate);
                return rate;
              })
          .orElseGet(
              () -> {
                log.warn(
                    "No recorded rate for {} in DB — using system default {}. "
                        + "Run price refresh to populate fx_rates_history.",
                    currencyPair,
                    systemDefault);
                return systemDefault;
              });
    } catch (Exception e) {
      log.warn(
          "Could not query fx_rates_history for {} (table may not exist yet) — using system default {}: {}",
          currencyPair,
          systemDefault,
          e.getMessage());
      return systemDefault;
    }
  }

  public void refreshPricesForAllHoldings() {
    List<Holding> holdings = holdingRepository.findAll();
    holdings.forEach(this::refreshPriceForHolding);
    log.info("Price refresh complete for {} holdings", holdings.size());
  }

  private void refreshPriceForHolding(Holding holding) {
    // Skip placeholder tickers where ticker == categoryId (e.g. "CASH" holding for bank cash)
    if (holding.categoryId() != null && holding.ticker().equalsIgnoreCase(holding.categoryId())) {
      log.debug("Skipping price lookup for placeholder ticker: {}", holding.ticker());
      return;
    }

    LocalDate today = LocalDate.now();
    LocalDate from = today.minusDays(7);

    // Attempt a live price for every real ticker — including manually-priced holdings. A "Refresh
    // Prices" action is expected to fetch the latest price for all positions; a manually-entered
    // price is only preserved when the provider has no data for the ticker (e.g. a delisted/renamed
    // symbol or an untracked asset), so the user's fallback value is never lost.
    Optional<BigDecimal> latestClose = fetchLatestClose(holding.ticker(), from, today);

    if (latestClose.isPresent()) {
      holdingRepository.updatePrice(holding.ticker(), latestClose.get(), today, PRICE_SOURCE_YAHOO);
      log.debug("Updated price for {}: {}", holding.ticker(), latestClose.get());
    } else if ("manual".equals(holding.priceSource())) {
      log.debug("Keeping manual price for {} — no live data available", holding.ticker());
    } else {
      log.warn("No price found for ticker: {}", holding.ticker());
    }
  }

  private Optional<BigDecimal> fetchLatestClose(String ticker, LocalDate from, LocalDate to) {
    try {
      return yahooFinanceClient.fetchChart(ticker, from, to).flatMap(this::extractLatestAdjClose);
    } catch (Exception e) {
      log.warn("Failed to fetch price for {}: {}", ticker, e.getMessage());
      return Optional.empty();
    }
  }

  private Optional<BigDecimal> extractLatestAdjClose(YahooChartResponse response) {
    if (response.chart() == null
        || response.chart().result() == null
        || response.chart().result().isEmpty()) {
      return Optional.empty();
    }
    YahooChartResponse.Result result = response.chart().result().getFirst();
    if (result.indicators() == null
        || result.indicators().adjclose() == null
        || result.indicators().adjclose().isEmpty()) {
      return Optional.empty();
    }
    List<BigDecimal> adjCloses = result.indicators().adjclose().getFirst().adjclose();
    if (adjCloses == null || adjCloses.isEmpty()) {
      return Optional.empty();
    }
    // Walk backwards to find the last non-null entry
    for (int i = adjCloses.size() - 1; i >= 0; i--) {
      if (adjCloses.get(i) != null) {
        return Optional.of(adjCloses.get(i));
      }
    }
    return Optional.empty();
  }
}

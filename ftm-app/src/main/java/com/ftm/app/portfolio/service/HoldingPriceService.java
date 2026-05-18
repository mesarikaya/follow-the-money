package com.ftm.app.portfolio.service;

import com.ftm.app.domain.Holding;
import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import com.ftm.app.portfolio.repository.HoldingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
public class HoldingPriceService {

    private static final Logger log = LoggerFactory.getLogger(HoldingPriceService.class);
    private static final String DEXUSEU = "DEXUSEU";
    private static final String PRICE_SOURCE_YAHOO = "yahoo_finance";
    private static final BigDecimal FALLBACK_USD_PER_EUR = new BigDecimal("1.08");

    private final HoldingRepository holdingRepository;
    private final YahooFinanceClient yahooFinanceClient;
    private final FredClient fredClient;

    public HoldingPriceService(
            HoldingRepository holdingRepository,
            YahooFinanceClient yahooFinanceClient,
            FredClient fredClient) {
        this.holdingRepository = holdingRepository;
        this.yahooFinanceClient = yahooFinanceClient;
        this.fredClient = fredClient;
    }

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
            log.warn("Could not fetch USD/EUR rate from FRED, using fallback {}: {}", FALLBACK_USD_PER_EUR, e.getMessage());
        }
        return FALLBACK_USD_PER_EUR;
    }

    public void refreshPricesForAllHoldings() {
        List<Holding> holdings = holdingRepository.findAll();
        holdings.forEach(this::refreshPriceForHolding);
        log.info("Price refresh complete for {} holdings", holdings.size());
    }

    private void refreshPriceForHolding(Holding holding) {
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(7);

        Optional<BigDecimal> latestClose = fetchLatestClose(holding.ticker(), from, today);

        if (latestClose.isPresent()) {
            holdingRepository.updatePrice(holding.ticker(), latestClose.get(), today, PRICE_SOURCE_YAHOO);
            log.debug("Updated price for {}: {}", holding.ticker(), latestClose.get());
        } else {
            log.warn("No price found for ticker: {}", holding.ticker());
        }
    }

    private Optional<BigDecimal> fetchLatestClose(String ticker, LocalDate from, LocalDate to) {
        try {
            return yahooFinanceClient.fetchChart(ticker, from, to)
                    .flatMap(this::extractLatestAdjClose);
        } catch (Exception e) {
            log.warn("Failed to fetch price for {}: {}", ticker, e.getMessage());
            return Optional.empty();
        }
    }

    private Optional<BigDecimal> extractLatestAdjClose(YahooChartResponse response) {
        if (response.chart() == null || response.chart().result() == null || response.chart().result().isEmpty()) {
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

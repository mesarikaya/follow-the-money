package com.ftm.app.ingestion.service;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import com.ftm.app.ingestion.repository.BenchmarkPriceRepository;
import com.ftm.app.ingestion.repository.RawPriceRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PricesIngestionHandler {

  private static final Logger log = LoggerFactory.getLogger(PricesIngestionHandler.class);
  private static final int BACKFILL_YEARS = 7;
  private static final ZoneId NY = ZoneId.of("America/New_York");
  private static final Set<String> BENCHMARKS = Set.of("SPY", "AGG");

  private final CategoryRepository categoryRepository;
  private final YahooFinanceClient yahooClient;
  private final RawPriceRepository rawPriceRepo;
  private final BenchmarkPriceRepository benchmarkRepo;

  public PricesIngestionHandler(
      CategoryRepository categoryRepository,
      YahooFinanceClient yahooClient,
      RawPriceRepository rawPriceRepo,
      BenchmarkPriceRepository benchmarkRepo) {
    this.categoryRepository = categoryRepository;
    this.yahooClient = yahooClient;
    this.rawPriceRepo = rawPriceRepo;
    this.benchmarkRepo = benchmarkRepo;
  }

  public IngestionResult fetchAndPersist(LocalDate today) {
    int totalRows = 0;
    List<String> errors = new ArrayList<>();

    for (Category category : categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()) {
      totalRows += fetchCategoryPrices(category, today, errors);
    }
    for (String ticker : BENCHMARKS) {
      totalRows += fetchBenchmarkPrices(ticker, today, errors);
    }

    return errors.isEmpty()
        ? IngestionResult.success(totalRows)
        : IngestionResult.partial(totalRows, errors);
  }

  private int fetchCategoryPrices(Category category, LocalDate today, List<String> errors) {
    try {
      LocalDate from =
          rawPriceRepo
              .findMaxTradeDate(category.id().name())
              .map(d -> d.plusDays(1))
              .orElse(today.minusYears(BACKFILL_YEARS));
      if (!from.isBefore(today)) return 0;

      return yahooClient
          .fetchChart(category.etfTicker(), from, today)
          .map(r -> rawPriceRepo.batchInsert(toRawPriceRows(r, category.id().name())))
          .orElse(0);
    } catch (Exception ex) {
      log.warn("Price fetch failed for {}: {}", category.id(), ex.getMessage());
      errors.add(category.id() + ": " + ex.getMessage());
      return 0;
    }
  }

  private int fetchBenchmarkPrices(String ticker, LocalDate today, List<String> errors) {
    try {
      LocalDate from =
          benchmarkRepo
              .findMaxTradeDate(ticker)
              .map(d -> d.plusDays(1))
              .orElse(today.minusYears(BACKFILL_YEARS));
      if (!from.isBefore(today)) return 0;

      return yahooClient
          .fetchChart(ticker, from, today)
          .map(r -> benchmarkRepo.batchInsert(toBenchmarkRows(r, ticker)))
          .orElse(0);
    } catch (Exception ex) {
      log.warn("Benchmark fetch failed for {}: {}", ticker, ex.getMessage());
      errors.add(ticker + ": " + ex.getMessage());
      return 0;
    }
  }

  private List<RawPriceRepository.Row> toRawPriceRows(
      YahooChartResponse response, String categoryId) {
    YahooChartResponse.Result result = firstResult(response);
    List<Long> timestamps = result.timestamp();
    if (timestamps == null || timestamps.isEmpty()) return List.of();
    YahooChartResponse.Quote quote = result.indicators().quote().getFirst();
    List<BigDecimal> adjCloses = result.indicators().adjclose().getFirst().adjclose();

    List<RawPriceRepository.Row> rows = new ArrayList<>();
    for (int i = 0; i < timestamps.size(); i++) {
      BigDecimal open = safeGet(quote.open(), i);
      BigDecimal high = safeGet(quote.high(), i);
      BigDecimal low = safeGet(quote.low(), i);
      BigDecimal close = safeGet(quote.close(), i);
      BigDecimal adjClose = safeGet(adjCloses, i);
      Long volume = safeGet(quote.volume(), i);
      if (open == null
          || high == null
          || low == null
          || close == null
          || adjClose == null
          || volume == null) continue;

      LocalDate date = Instant.ofEpochSecond(timestamps.get(i)).atZone(NY).toLocalDate();
      rows.add(
          new RawPriceRepository.Row(date, categoryId, open, high, low, close, adjClose, volume));
    }
    return rows;
  }

  private List<BenchmarkPriceRepository.Row> toBenchmarkRows(
      YahooChartResponse response, String ticker) {
    YahooChartResponse.Result result = firstResult(response);
    List<Long> timestamps = result.timestamp();
    if (timestamps == null || timestamps.isEmpty()) return List.of();
    List<BigDecimal> adjCloses = result.indicators().adjclose().getFirst().adjclose();

    List<BenchmarkPriceRepository.Row> rows = new ArrayList<>();
    for (int i = 0; i < timestamps.size(); i++) {
      BigDecimal adjClose = safeGet(adjCloses, i);
      if (adjClose == null) continue;
      LocalDate date = Instant.ofEpochSecond(timestamps.get(i)).atZone(NY).toLocalDate();
      rows.add(new BenchmarkPriceRepository.Row(date, ticker, adjClose));
    }
    return rows;
  }

  private YahooChartResponse.Result firstResult(YahooChartResponse response) {
    if (response.chart() == null
        || response.chart().result() == null
        || response.chart().result().isEmpty()) {
      throw new IllegalStateException("Empty chart result from Yahoo Finance");
    }
    return response.chart().result().get(0);
  }

  private <T> T safeGet(List<T> list, int i) {
    return (list != null && i < list.size()) ? list.get(i) : null;
  }
}

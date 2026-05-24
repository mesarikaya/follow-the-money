package com.ftm.app.signals.service;

import static com.ftm.app.jooq.Tables.BENCHMARK_PRICES;
import static com.ftm.app.jooq.Tables.RAW_PRICES;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SignalComputationService {

  private static final Logger log = LoggerFactory.getLogger(SignalComputationService.class);

  private static final int LOOKBACK_DAYS = 365;
  private static final int MOM_LAG = 10;
  private static final int RRG_RS_PERIOD = 20;
  private static final int RRG_RATIO_EMA = 10;
  private static final int RRG_MOM_EMA = 5;
  private static final int UPSERT_CHUNK_SIZE = 5_000;

  private record DatePrice(LocalDate date, BigDecimal price) {}

  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final RelativeStrengthCalculator rsCalc;
  private final RrgCalculator rrgCalc;
  private final MacroRegimeService macroRegimeService;
  private final CompositeScoreService compositeScoreService;
  private final DSLContext dsl;
  private final ApplicationEventPublisher events;

  public SignalComputationService(
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      RelativeStrengthCalculator rsCalc,
      RrgCalculator rrgCalc,
      MacroRegimeService macroRegimeService,
      CompositeScoreService compositeScoreService,
      DSLContext dsl,
      ApplicationEventPublisher events) {
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.rsCalc = rsCalc;
    this.rrgCalc = rrgCalc;
    this.macroRegimeService = macroRegimeService;
    this.compositeScoreService = compositeScoreService;
    this.dsl = dsl;
    this.events = events;
  }

  @Transactional
  public void computeAndStore() {
    List<LocalDate> allTradeDates = signalRepository.findAllTradeDatesAscending();
    if (allTradeDates.isEmpty()) {
      log.warn("No price data found; skipping signal computation");
      return;
    }

    Optional<LocalDate> latestSignalDate = signalRepository.findLatestSignalDate();
    List<LocalDate> datesToProcess =
        latestSignalDate
            .map(lastDate -> allTradeDates.stream().filter(d -> d.isAfter(lastDate)).toList())
            .orElse(allTradeDates);

    List<Category> categories = categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc();

    if (datesToProcess.isEmpty()) {
      Set<String> categoryIdsWithSignals = signalRepository.findAllCategoryIdsWithSignals();
      boolean hasNewCategories =
          categories.stream().anyMatch(c -> !categoryIdsWithSignals.contains(c.id().name()));
      if (!hasNewCategories) {
        log.info("Signals are up to date through {} — nothing to compute", latestSignalDate.get());
        return;
      }
      log.info(
          "New categories detected without signals — running full historical backfill for all {} trade dates",
          allTradeDates.size());
      datesToProcess = allTradeDates;
    }

    LocalDate latestDate = datesToProcess.get(datesToProcess.size() - 1);
    log.info(
        "Computing signals for {} dates ({} → {}), latest existing signal={}",
        datesToProcess.size(),
        datesToProcess.get(0),
        latestDate,
        latestSignalDate.orElse(null));

    if (datesToProcess.size() > 1) {
      log.warn(
          "Historical backfill uses the CURRENT macro regime ({}) for all {} dates. "
              + "Backtesting results covering different market regimes may be biased.",
          macroRegimeService.classifyCurrentRegime(),
          datesToProcess.size());
    }
    Map<String, List<DatePrice>> categoryPricesByCategory = loadAllCategoryPricesWithDates();
    Map<String, List<DatePrice>> benchmarkPricesByTicker = loadAllBenchmarkPricesWithDates();

    MacroRegime currentRegime = macroRegimeService.classifyCurrentRegime();
    Map<String, BigDecimal> macroFitByCategoryId =
        macroRegimeService.computeMacroFitByCategory(currentRegime);
    BigDecimal regimeOrdinal = BigDecimal.valueOf(currentRegime.ordinal());

    List<SignalRepository.Row> pendingRows = new ArrayList<>();
    int totalWritten = 0;

    for (LocalDate signalDate : datesToProcess) {
      LocalDate windowStart = signalDate.minusDays(LOOKBACK_DAYS);

      Map<String, BigDecimal> rs60ByCategoryId = new HashMap<>();
      Map<String, BigDecimal> momentumByCategoryId = new HashMap<>();
      Map<String, BigDecimal> rrgQuadrantByCategoryId = new HashMap<>();

      for (Category category : categories) {
        String categoryId = category.id().name();
        List<BigDecimal> categoryPrices =
            extractPricesInWindow(
                categoryPricesByCategory.get(categoryId), windowStart, signalDate);
        List<BigDecimal> benchmarkPrices =
            extractPricesInWindow(
                benchmarkPricesByTicker.get(category.benchmarkTicker()), windowStart, signalDate);

        BigDecimal rs20 = rsCalc.computeRs(categoryPrices, benchmarkPrices, 20);
        BigDecimal rs60 = rsCalc.computeRs(categoryPrices, benchmarkPrices, 60);
        BigDecimal rs120 = rsCalc.computeRs(categoryPrices, benchmarkPrices, 120);
        BigDecimal momentum = rsCalc.computeMom(categoryPrices, benchmarkPrices, MOM_LAG);

        addIfNotNull(pendingRows, signalDate, categoryId, SignalType.RS_20, rs20);
        addIfNotNull(pendingRows, signalDate, categoryId, SignalType.RS_60, rs60);
        addIfNotNull(pendingRows, signalDate, categoryId, SignalType.RS_120, rs120);
        addIfNotNull(pendingRows, signalDate, categoryId, SignalType.MOM, momentum);

        if (rs60 != null) rs60ByCategoryId.put(categoryId, rs60);
        if (momentum != null) momentumByCategoryId.put(categoryId, momentum);

        List<BigDecimal> rs20Series =
            rsCalc.computeRsSeries(categoryPrices, benchmarkPrices, RRG_RS_PERIOD);
        List<BigDecimal> ratioSeries = rrgCalc.computeRatioSeries(rs20Series, RRG_RATIO_EMA);
        List<BigDecimal> momentumSeries = rrgCalc.computeMomentumSeries(ratioSeries, RRG_MOM_EMA);
        BigDecimal latestRatio = lastNonNull(ratioSeries);
        BigDecimal latestRrgMom = lastNonNull(momentumSeries);

        addIfNotNull(pendingRows, signalDate, categoryId, SignalType.RRG_RATIO, latestRatio);
        addIfNotNull(pendingRows, signalDate, categoryId, SignalType.RRG_MOM, latestRrgMom);
        if (latestRatio != null && latestRrgMom != null) {
          BigDecimal quadrant =
              BigDecimal.valueOf(rrgCalc.computeQuadrant(latestRatio, latestRrgMom));
          pendingRows.add(
              new SignalRepository.Row(signalDate, categoryId, SignalType.RRG_QUADRANT, quadrant));
          rrgQuadrantByCategoryId.put(categoryId, quadrant);
        }
      }

      Map<String, BigDecimal> compositeScoresByCategoryId =
          compositeScoreService.computeCompositeScores(
              rs60ByCategoryId,
              Map.of(),
              momentumByCategoryId,
              macroFitByCategoryId,
              rrgQuadrantByCategoryId);

      for (Category category : categories) {
        String categoryId = category.id().name();
        if (category.parentId() == null) {
          pendingRows.add(
              new SignalRepository.Row(
                  signalDate, categoryId, SignalType.MACRO_REGIME, regimeOrdinal));
          addIfNotNull(
              pendingRows,
              signalDate,
              categoryId,
              SignalType.MACRO_FIT,
              macroFitByCategoryId.get(categoryId));
        }
        addIfNotNull(
            pendingRows,
            signalDate,
            categoryId,
            SignalType.COMPOSITE,
            compositeScoresByCategoryId.get(categoryId));
      }

      if (pendingRows.size() >= UPSERT_CHUNK_SIZE) {
        totalWritten += signalRepository.batchUpsert(pendingRows);
        pendingRows.clear();
      }
    }

    if (!pendingRows.isEmpty()) {
      totalWritten += signalRepository.batchUpsert(pendingRows);
    }

    log.info(
        "Signal computation complete: {} signals written for {} dates, regime={}",
        totalWritten,
        datesToProcess.size(),
        currentRegime);

    int trendSignals = computeAndStoreTrends();
    log.info("Composite trend signals stored: {}", trendSignals);

    events.publishEvent(new SignalsUpdatedEvent(latestDate));
  }

  private int computeAndStoreTrends() {
    List<SignalRepository.Row> allComposites =
        signalRepository.findAllByType(SignalType.COMPOSITE);
    if (allComposites.isEmpty()) return 0;

    Map<String, List<SignalRepository.Row>> byCategory =
        allComposites.stream()
            .collect(
                Collectors.groupingBy(
                    SignalRepository.Row::categoryId, LinkedHashMap::new, Collectors.toList()));

    int[] lags = {5, 10, 20};
    SignalType[] trendTypes = {
      SignalType.COMPOSITE_TREND_5D,
      SignalType.COMPOSITE_TREND_10D,
      SignalType.COMPOSITE_TREND_20D
    };

    List<SignalRepository.Row> trendRows = new ArrayList<>();

    for (Map.Entry<String, List<SignalRepository.Row>> entry : byCategory.entrySet()) {
      String categoryId = entry.getKey();
      List<SignalRepository.Row> composites = entry.getValue();

      for (int li = 0; li < lags.length; li++) {
        int lag = lags[li];
        SignalType trendType = trendTypes[li];

        for (int j = lag; j < composites.size(); j++) {
          BigDecimal current = composites.get(j).value();
          BigDecimal prior = composites.get(j - lag).value();
          if (current != null && prior != null) {
            trendRows.add(
                new SignalRepository.Row(
                    composites.get(j).signalDate(),
                    categoryId,
                    trendType,
                    current.subtract(prior)));
          }
        }
      }
    }

    return trendRows.isEmpty() ? 0 : signalRepository.batchUpsert(trendRows);
  }

  private Map<String, List<DatePrice>> loadAllCategoryPricesWithDates() {
    return dsl
        .select(RAW_PRICES.CATEGORY_ID, RAW_PRICES.TRADE_DATE, RAW_PRICES.ADJ_CLOSE)
        .from(RAW_PRICES)
        .orderBy(RAW_PRICES.CATEGORY_ID, RAW_PRICES.TRADE_DATE.asc())
        .fetch()
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> r.get(RAW_PRICES.CATEGORY_ID),
                Collectors.mapping(
                    r -> new DatePrice(r.get(RAW_PRICES.TRADE_DATE), r.get(RAW_PRICES.ADJ_CLOSE)),
                    Collectors.toList())));
  }

  private Map<String, List<DatePrice>> loadAllBenchmarkPricesWithDates() {
    return dsl
        .select(BENCHMARK_PRICES.TICKER, BENCHMARK_PRICES.TRADE_DATE, BENCHMARK_PRICES.ADJ_CLOSE)
        .from(BENCHMARK_PRICES)
        .orderBy(BENCHMARK_PRICES.TICKER, BENCHMARK_PRICES.TRADE_DATE.asc())
        .fetch()
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> r.get(BENCHMARK_PRICES.TICKER),
                Collectors.mapping(
                    r ->
                        new DatePrice(
                            r.get(BENCHMARK_PRICES.TRADE_DATE), r.get(BENCHMARK_PRICES.ADJ_CLOSE)),
                    Collectors.toList())));
  }

  private List<BigDecimal> extractPricesInWindow(
      List<DatePrice> allPrices, LocalDate windowStart, LocalDate windowEnd) {
    if (allPrices == null || allPrices.isEmpty()) return List.of();
    return allPrices.stream()
        .filter(dp -> !dp.date().isBefore(windowStart) && !dp.date().isAfter(windowEnd))
        .map(DatePrice::price)
        .toList();
  }

  private void addIfNotNull(
      List<SignalRepository.Row> rows,
      LocalDate date,
      String categoryId,
      SignalType type,
      BigDecimal value) {
    if (value != null) {
      rows.add(new SignalRepository.Row(date, categoryId, type, value));
    }
  }

  private BigDecimal lastNonNull(List<BigDecimal> series) {
    for (int i = series.size() - 1; i >= 0; i--) {
      BigDecimal value = series.get(i);
      if (value != null) return value;
    }
    return null;
  }
}

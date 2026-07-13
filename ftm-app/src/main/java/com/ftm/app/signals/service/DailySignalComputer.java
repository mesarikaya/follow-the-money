package com.ftm.app.signals.service;

import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.PriceHistoryRepository.DatePrice;
import com.ftm.app.signals.repository.SignalRepository.Row;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Computes every signal for one trading day: each category's relative strength against its
 * benchmark, its momentum, its breadth, its flow, its position on the rotation graph — and then the
 * composite score that blends them, which can only be scored once the whole day's cross-section is
 * known.
 */
@Component
public class DailySignalComputer {

  private static final int LOOKBACK_DAYS = 365;
  private static final int MOMENTUM_LAG = 10;
  private static final int FLOW_PERIOD = 20;

  private static final int RRG_RS_PERIOD = 20;
  private static final int RRG_RATIO_EMA = 10;
  private static final int RRG_MOM_EMA = 5;

  private final RelativeStrengthCalculator relativeStrengthCalculator;
  private final RrgCalculator rrgCalculator;
  private final CompositeScoreService compositeScoreService;
  private final FlowZScoreCalculator flowZScoreCalculator;

  public DailySignalComputer(
      RelativeStrengthCalculator relativeStrengthCalculator,
      RrgCalculator rrgCalculator,
      CompositeScoreService compositeScoreService,
      FlowZScoreCalculator flowZScoreCalculator) {
    this.relativeStrengthCalculator = relativeStrengthCalculator;
    this.rrgCalculator = rrgCalculator;
    this.compositeScoreService = compositeScoreService;
    this.flowZScoreCalculator = flowZScoreCalculator;
  }

  /** The price history and macro read-out a day's computation draws on. */
  public record MarketContext(
      List<Category> categories,
      Map<String, List<DatePrice>> categoryPricesByCategoryId,
      Map<String, List<DatePrice>> benchmarkPricesByTicker,
      Map<String, BigDecimal> macroFitByCategoryId,
      BigDecimal regimeOrdinal) {}

  public List<Row> compute(LocalDate signalDate, MarketContext context) {
    List<Row> rows = new ArrayList<>();
    CrossSection crossSection = new CrossSection();

    for (Category category : context.categories()) {
      computeForCategory(signalDate, category, context, rows, crossSection);
    }

    Map<String, BigDecimal> compositeScores =
        compositeScoreService.computeCompositeScores(
            crossSection.rs60,
            crossSection.rs120,
            crossSection.persistence20d,
            crossSection.flow20d,
            crossSection.momentum,
            context.macroFitByCategoryId(),
            crossSection.rrgQuadrant);

    for (Category category : context.categories()) {
      rows.addAll(macroAndCompositeRows(signalDate, category, context, compositeScores));
    }
    return rows;
  }

  private void computeForCategory(
      LocalDate signalDate,
      Category category,
      MarketContext context,
      List<Row> rows,
      CrossSection crossSection) {

    String categoryId = category.id().name();
    LocalDate windowStart = signalDate.minusDays(LOOKBACK_DAYS);

    List<DatePrice> categoryWindow =
        window(context.categoryPricesByCategoryId().get(categoryId), windowStart, signalDate);
    List<BigDecimal> categoryPrices = pricesOf(categoryWindow);
    List<BigDecimal> benchmarkPrices =
        pricesOf(
            window(
                context.benchmarkPricesByTicker().get(category.benchmarkTicker()),
                windowStart,
                signalDate));

    BigDecimal rs20 = relativeStrengthCalculator.computeRs(categoryPrices, benchmarkPrices, 20);
    BigDecimal rs60 = relativeStrengthCalculator.computeRs(categoryPrices, benchmarkPrices, 60);
    BigDecimal rs120 = relativeStrengthCalculator.computeRs(categoryPrices, benchmarkPrices, 120);
    BigDecimal momentum =
        relativeStrengthCalculator.computeMom(categoryPrices, benchmarkPrices, MOMENTUM_LAG);
    BigDecimal persistence5d =
        relativeStrengthCalculator.computePersistence(categoryPrices, benchmarkPrices, 5);
    BigDecimal persistence20d =
        relativeStrengthCalculator.computePersistence(categoryPrices, benchmarkPrices, 20);
    BigDecimal flow20d =
        flowZScoreCalculator.computeDollarVolumeZScore(categoryWindow, FLOW_PERIOD);

    addIfPresent(rows, signalDate, categoryId, SignalType.RS_20, rs20);
    addIfPresent(rows, signalDate, categoryId, SignalType.RS_60, rs60);
    addIfPresent(rows, signalDate, categoryId, SignalType.RS_120, rs120);
    addIfPresent(rows, signalDate, categoryId, SignalType.MOM, momentum);
    addIfPresent(rows, signalDate, categoryId, SignalType.PERSISTENCE_5D, persistence5d);
    addIfPresent(rows, signalDate, categoryId, SignalType.PERSISTENCE_20D, persistence20d);
    addIfPresent(rows, signalDate, categoryId, SignalType.FLOW_20D, flow20d);

    crossSection.record(categoryId, rs60, rs120, persistence20d, momentum, flow20d);

    addRotationRows(signalDate, categoryId, categoryPrices, benchmarkPrices, rows, crossSection);
  }

  /** Where the category sits on the relative rotation graph, and which quadrant that puts it in. */
  private void addRotationRows(
      LocalDate signalDate,
      String categoryId,
      List<BigDecimal> categoryPrices,
      List<BigDecimal> benchmarkPrices,
      List<Row> rows,
      CrossSection crossSection) {

    List<BigDecimal> rsSeries =
        relativeStrengthCalculator.computeRsSeries(categoryPrices, benchmarkPrices, RRG_RS_PERIOD);
    List<BigDecimal> ratioSeries = rrgCalculator.computeRatioSeries(rsSeries, RRG_RATIO_EMA);
    List<BigDecimal> momentumSeries = rrgCalculator.computeMomentumSeries(ratioSeries, RRG_MOM_EMA);

    BigDecimal ratio = lastNonNull(ratioSeries);
    BigDecimal momentum = lastNonNull(momentumSeries);

    addIfPresent(rows, signalDate, categoryId, SignalType.RRG_RATIO, ratio);
    addIfPresent(rows, signalDate, categoryId, SignalType.RRG_MOM, momentum);

    if (ratio == null || momentum == null) return;
    BigDecimal quadrant = BigDecimal.valueOf(rrgCalculator.computeQuadrant(ratio, momentum));
    rows.add(new Row(signalDate, categoryId, SignalType.RRG_QUADRANT, quadrant));
    crossSection.rrgQuadrant.put(categoryId, quadrant);
  }

  /** The macro regime is a top-level property; sub-sectors inherit it rather than store it. */
  private static List<Row> macroAndCompositeRows(
      LocalDate signalDate,
      Category category,
      MarketContext context,
      Map<String, BigDecimal> compositeScores) {

    String categoryId = category.id().name();
    List<Row> rows = new ArrayList<>();
    if (category.parentId() == null) {
      rows.add(new Row(signalDate, categoryId, SignalType.MACRO_REGIME, context.regimeOrdinal()));
      addIfPresent(
          rows,
          signalDate,
          categoryId,
          SignalType.MACRO_FIT,
          context.macroFitByCategoryId().get(categoryId));
    }
    addIfPresent(
        rows, signalDate, categoryId, SignalType.COMPOSITE, compositeScores.get(categoryId));
    return rows;
  }

  /** The day's readings across every category — what the composite score is scored against. */
  private static final class CrossSection {
    final Map<String, BigDecimal> rs60 = new HashMap<>();
    final Map<String, BigDecimal> rs120 = new HashMap<>();
    final Map<String, BigDecimal> persistence20d = new HashMap<>();
    final Map<String, BigDecimal> momentum = new HashMap<>();
    final Map<String, BigDecimal> flow20d = new HashMap<>();
    final Map<String, BigDecimal> rrgQuadrant = new HashMap<>();

    void record(
        String categoryId,
        BigDecimal rs60Value,
        BigDecimal rs120Value,
        BigDecimal persistence20dValue,
        BigDecimal momentumValue,
        BigDecimal flow20dValue) {
      putIfPresent(rs60, categoryId, rs60Value);
      putIfPresent(rs120, categoryId, rs120Value);
      putIfPresent(persistence20d, categoryId, persistence20dValue);
      putIfPresent(momentum, categoryId, momentumValue);
      putIfPresent(flow20d, categoryId, flow20dValue);
    }

    private static void putIfPresent(
        Map<String, BigDecimal> values, String categoryId, BigDecimal value) {
      if (value != null) values.put(categoryId, value);
    }
  }

  private static List<DatePrice> window(
      List<DatePrice> prices, LocalDate windowStart, LocalDate windowEnd) {
    if (prices == null || prices.isEmpty()) return List.of();
    return prices.stream()
        .filter(day -> !day.date().isBefore(windowStart) && !day.date().isAfter(windowEnd))
        .toList();
  }

  private static List<BigDecimal> pricesOf(List<DatePrice> window) {
    return window.stream().map(DatePrice::price).toList();
  }

  private static void addIfPresent(
      List<Row> rows, LocalDate date, String categoryId, SignalType type, BigDecimal value) {
    if (value != null) rows.add(new Row(date, categoryId, type, value));
  }

  private static BigDecimal lastNonNull(List<BigDecimal> series) {
    for (int i = series.size() - 1; i >= 0; i--) {
      if (series.get(i) != null) return series.get(i);
    }
    return null;
  }
}

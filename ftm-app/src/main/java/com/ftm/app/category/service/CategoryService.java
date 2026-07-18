package com.ftm.app.category.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.PriceLevelDto;
import com.ftm.app.api.dto.ScreenerSnapshotDto;
import com.ftm.app.api.dto.SeasonalReturnDto;
import com.ftm.app.api.dto.SignalTransitionDto;
import com.ftm.app.api.dto.SignalWinRateDto;
import com.ftm.app.alerts.service.AlertService;
import com.ftm.app.api.service.ScreenerSnapshotCalculator;
import com.ftm.app.signals.service.SignalTransitionAssembler;
import com.ftm.app.signals.service.SignalTransitionAssembler.TransitionContext;
import com.ftm.app.category.mapper.CategoryMapper;
import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.category.repository.CategoryRepository.CategoryPriceRow;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalAnalyticsRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

/**
 * Serves the category views: the ranked screener table, its snapshot, score history, price levels,
 * signal transitions, win rates and seasonality. It loads the signals each view needs and hands the
 * shaping to the mapper and the two calculators.
 */
@Service
public class CategoryService {

  private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

  private static final BigDecimal SIGNAL_ACTIVE_THRESHOLD = new BigDecimal("0.50");

  private static final int MIN_HISTORY_DAYS = 5;
  private static final int MAX_HISTORY_DAYS = 120;
  private static final int MIN_WIN_RATE_LOOKBACK_DAYS = 90;
  private static final int MAX_WIN_RATE_LOOKBACK_DAYS = 730;
  private static final int MIN_TRANSITION_LOOKBACK_DAYS = 1;
  private static final int MAX_TRANSITION_LOOKBACK_DAYS = 90;

  /** Every signal type the screener table shows, besides the timeframe-dependent RS window. */
  private static final List<SignalType> SCREENER_SIGNAL_TYPES =
      List.of(
          SignalType.COMPOSITE,
          SignalType.RRG_QUADRANT,
          SignalType.COMPOSITE_TREND_5D,
          SignalType.COMPOSITE_TREND_10D,
          SignalType.COMPOSITE_TREND_20D,
          SignalType.RS_120,
          SignalType.RS_20,
          SignalType.FLOW_20D,
          SignalType.PERSISTENCE_5D,
          SignalType.PERSISTENCE_20D,
          SignalType.MACRO_FIT,
          SignalType.MOM);

  private static final List<SignalType> SNAPSHOT_SIGNAL_TYPES =
      List.of(
          SignalType.COMPOSITE,
          SignalType.RRG_QUADRANT,
          SignalType.COMPOSITE_TREND_20D,
          SignalType.RS_60,
          SignalType.RS_20);

  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final SignalAnalyticsRepository signalAnalyticsRepository;
  private final CategoryMapper categoryMapper;
  private final AlertService alertService;
  private final ScreenerSnapshotCalculator screenerSnapshotCalculator;
  private final SignalTransitionAssembler signalTransitionAssembler;

  public CategoryService(
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      SignalAnalyticsRepository signalAnalyticsRepository,
      CategoryMapper categoryMapper,
      AlertService alertService,
      ScreenerSnapshotCalculator screenerSnapshotCalculator,
      SignalTransitionAssembler signalTransitionAssembler) {
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.signalAnalyticsRepository = signalAnalyticsRepository;
    this.categoryMapper = categoryMapper;
    this.alertService = alertService;
    this.screenerSnapshotCalculator = screenerSnapshotCalculator;
    this.signalTransitionAssembler = signalTransitionAssembler;
  }

  /** The latest value of every signal type a view asked for, per category. */
  private record LatestSignals(Map<SignalType, Map<String, BigDecimal>> byType) {

    Map<String, BigDecimal> of(SignalType type) {
      return byType.getOrDefault(type, Collections.emptyMap());
    }
  }

  @Cacheable(value = "signals-latest", key = "#timeframe")
  public CategoriesResponse getCategoriesResponse(String timeframe) {
    log.debug("Loading categories for timeframe={}", timeframe);

    SignalType rsType = rsTypeForTimeframe(timeframe);
    LatestSignals signals = fetchScreenerSignals(rsType);

    List<CategoryPriceRow> rankedRows =
        rankByRelativeStrength(
            categoryRepository.findAllWithLatestPrice(),
            signals.of(rsType),
            signals.of(SignalType.COMPOSITE));

    Map<String, Integer> signalDaysActive =
        signalAnalyticsRepository.findSignalDaysActive(SIGNAL_ACTIVE_THRESHOLD);
    Map<String, BigDecimal> realizedVolatility20d =
        signalAnalyticsRepository.findRealizedVolatility20d();
    Map<String, BigDecimal> scorePercentile252d = signalAnalyticsRepository.findScorePercentile252d();
    Map<String, Integer> activeAlertCounts = alertService.getActiveAlertCountsByCategory();
    Map<String, Integer> scoreStreakDays = signalAnalyticsRepository.findScoreStreakDays();

    AtomicInteger rank = new AtomicInteger(1);
    var categorySummaries =
        rankedRows.stream()
            .map(
                row ->
                    categoryMapper.toDto(
                        row,
                        rank.getAndIncrement(),
                        signals.of(rsType),
                        signals.of(SignalType.COMPOSITE),
                        signals.of(SignalType.RRG_QUADRANT),
                        signals.of(SignalType.COMPOSITE_TREND_5D),
                        signals.of(SignalType.COMPOSITE_TREND_10D),
                        signals.of(SignalType.COMPOSITE_TREND_20D),
                        signals.of(SignalType.RS_120),
                        signals.of(SignalType.RS_20),
                        signals.of(SignalType.FLOW_20D),
                        signals.of(SignalType.PERSISTENCE_5D),
                        signals.of(SignalType.PERSISTENCE_20D),
                        signals.of(SignalType.MACRO_FIT),
                        signals.of(SignalType.MOM),
                        signalDaysActive,
                        realizedVolatility20d,
                        scorePercentile252d,
                        activeAlertCounts,
                        scoreStreakDays))
            .toList();

    return new CategoriesResponse(latestPriceDate(rankedRows), timeframe, categorySummaries);
  }

  private LatestSignals fetchScreenerSignals(SignalType rsType) {
    // The RS type may already be in the list (RS_60 is the default) — ask for it only once.
    List<SignalType> types =
        java.util.stream.Stream.concat(java.util.stream.Stream.of(rsType), SCREENER_SIGNAL_TYPES.stream())
            .distinct()
            .toList();
    return new LatestSignals(signalRepository.findLatestByTypes(types));
  }

  /** Strongest relative strength first; the composite score breaks ties. */
  private static List<CategoryPriceRow> rankByRelativeStrength(
      List<CategoryPriceRow> rows,
      Map<String, BigDecimal> relativeStrength,
      Map<String, BigDecimal> composites) {
    Comparator<CategoryPriceRow> byRelativeStrength =
        Comparator.comparing(
            (CategoryPriceRow row) -> signalOf(relativeStrength, row), Comparator.reverseOrder());
    Comparator<CategoryPriceRow> byComposite =
        Comparator.comparing(
            (CategoryPriceRow row) -> signalOf(composites, row), Comparator.reverseOrder());
    return rows.stream().sorted(byRelativeStrength.thenComparing(byComposite)).toList();
  }

  private static BigDecimal signalOf(Map<String, BigDecimal> signal, CategoryPriceRow row) {
    return signal.getOrDefault(row.category().id().name(), BigDecimal.ZERO);
  }

  private static LocalDate latestPriceDate(List<CategoryPriceRow> rows) {
    return rows.stream()
        .map(CategoryPriceRow::priceDate)
        .filter(java.util.Objects::nonNull)
        .max(Comparator.naturalOrder())
        .orElse(LocalDate.now());
  }

  @Cacheable(value = "score-history", key = "#days")
  public Map<String, List<Double>> getCompositeScoreHistory(int days) {
    int clampedDays = clamp(days, MIN_HISTORY_DAYS, MAX_HISTORY_DAYS);
    Set<String> topLevelIds = categoryRepository.findTopLevelActiveCategoryIds();
    return signalAnalyticsRepository.findCompositeScoreHistory(clampedDays, topLevelIds)
        .entrySet()
        .stream()
        .collect(Collectors.toMap(Map.Entry::getKey, entry -> toDoubles(entry.getValue())));
  }

  private static List<Double> toDoubles(List<BigDecimal> values) {
    return values.stream()
        .map(value -> value == null ? null : value.doubleValue())
        .collect(Collectors.toList());
  }

  @Cacheable("price-levels")
  public List<PriceLevelDto> getPriceLevels() {
    return categoryRepository.findPriceLevels().stream()
        .map(
            level ->
                new PriceLevelDto(
                    level.categoryId(),
                    level.currentPrice(),
                    level.high252d(),
                    level.low252d(),
                    level.drawdownFromHigh(),
                    level.positionInRange(),
                    level.daysOfData()))
        .toList();
  }

  @Cacheable(value = "win-rates", key = "#lookbackDays")
  public List<SignalWinRateDto> getBuySignalWinRates(int lookbackDays) {
    int clampedDays =
        clamp(lookbackDays, MIN_WIN_RATE_LOOKBACK_DAYS, MAX_WIN_RATE_LOOKBACK_DAYS);
    return signalAnalyticsRepository.findBuySignalWinRates(clampedDays).stream()
        .map(
            winRate ->
                new SignalWinRateDto(
                    winRate.categoryId(),
                    winRate.signalCount(),
                    winRate.winRate(),
                    winRate.avgReturn30d(),
                    winRate.avgReturn90d()))
        .toList();
  }

  @Cacheable(value = "transitions-latest", key = "#lookbackDays")
  public List<SignalTransitionDto> getSignalTransitions(int lookbackDays) {
    int clampedDays =
        clamp(lookbackDays, MIN_TRANSITION_LOOKBACK_DAYS, MAX_TRANSITION_LOOKBACK_DAYS);
    TransitionContext context =
        new TransitionContext(
            topLevelCategoriesById(),
            signalAnalyticsRepository.findScorePercentile252d(),
            signalRepository
                .findLatestByTypes(List.of(SignalType.MACRO_FIT))
                .getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap()),
            signalAnalyticsRepository.findSignalDaysActive(SIGNAL_ACTIVE_THRESHOLD),
            clampedDays);
    return signalTransitionAssembler.assemble(
        signalAnalyticsRepository.findSignalSnapshotPairs(clampedDays), context);
  }

  private Map<String, Category> topLevelCategoriesById() {
    return categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
        .filter(category -> category.parentId() == null)
        .collect(Collectors.toMap(category -> category.id().name(), category -> category));
  }

  public ScreenerSnapshotDto getScreenerSnapshot() {
    Set<String> topLevelIds = categoryRepository.findTopLevelActiveCategoryIds();
    if (topLevelIds.isEmpty()) {
      return screenerSnapshotCalculator.calculate(topLevelIds, Map.of());
    }
    return screenerSnapshotCalculator.calculate(
        topLevelIds, signalRepository.findLatestByTypes(SNAPSHOT_SIGNAL_TYPES));
  }

  @Cacheable("seasonal-returns")
  public List<SeasonalReturnDto> getSeasonalReturns() {
    return categoryRepository.findSeasonalMonthlyReturns().stream()
        .map(
            seasonal ->
                new SeasonalReturnDto(
                    seasonal.categoryId(),
                    seasonal.month(),
                    seasonal.avgReturn(),
                    seasonal.sampleCount()))
        .toList();
  }

  private static int clamp(int value, int minimum, int maximum) {
    return Math.max(minimum, Math.min(value, maximum));
  }

  private SignalType rsTypeForTimeframe(String timeframe) {
    return switch (timeframe == null ? "MONTH" : timeframe.toUpperCase()) {
      case "DAY", "WEEK" -> SignalType.RS_20;
      case "QUARTER", "YEAR" -> SignalType.RS_120;
      default -> SignalType.RS_60; // MONTH and unknown
    };
  }
}

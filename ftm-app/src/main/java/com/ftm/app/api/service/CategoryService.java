package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.dto.PriceLevelDto;
import com.ftm.app.api.dto.SignalTransitionDto;
import com.ftm.app.api.dto.SignalWinRateDto;
import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
public class CategoryService {

  private static final Logger log = LoggerFactory.getLogger(CategoryService.class);

  private final CategoryRepository categoryRepository;
  private final SignalRepository signalRepository;
  private final CategoryMapper categoryMapper;

  public CategoryService(
      CategoryRepository categoryRepository,
      SignalRepository signalRepository,
      CategoryMapper categoryMapper) {
    this.categoryRepository = categoryRepository;
    this.signalRepository = signalRepository;
    this.categoryMapper = categoryMapper;
  }

  @Cacheable(value = "signals-latest", key = "#timeframe")
  public CategoriesResponse getCategoriesResponse(String timeframe) {
    log.debug("Loading categories for timeframe={}", timeframe);
    var rows = categoryRepository.findAllWithLatestPrice();
    SignalType rsType = rsTypeForTimeframe(timeframe);
    List<SignalType> typesToFetch =
        List.of(
            rsType,
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
    // Exclude duplicates when rsType is one of the already-listed types (e.g. RS_60 = default)
    var uniqueTypes = typesToFetch.stream().distinct().toList();
    Map<SignalType, Map<String, BigDecimal>> signals =
        signalRepository.findLatestByTypes(uniqueTypes);
    Map<String, BigDecimal> rsByCategory = signals.getOrDefault(rsType, Collections.emptyMap());
    Map<String, BigDecimal> compositeByCategoryId =
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap());
    Map<String, BigDecimal> rrgQuadrantByCategoryId =
        signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap());
    Map<String, BigDecimal> compositeTrend5dByCategoryId =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap());
    Map<String, BigDecimal> compositeTrend10dByCategoryId =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_10D, Collections.emptyMap());
    Map<String, BigDecimal> compositeTrend20dByCategoryId =
        signals.getOrDefault(SignalType.COMPOSITE_TREND_20D, Collections.emptyMap());
    Map<String, BigDecimal> rs120ByCategoryId =
        signals.getOrDefault(SignalType.RS_120, Collections.emptyMap());
    Map<String, BigDecimal> rs20ByCategoryId =
        signals.getOrDefault(SignalType.RS_20, Collections.emptyMap());
    Map<String, BigDecimal> flow20dByCategoryId =
        signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap());
    Map<String, BigDecimal> persistence5dByCategoryId =
        signals.getOrDefault(SignalType.PERSISTENCE_5D, Collections.emptyMap());
    Map<String, BigDecimal> persistence20dByCategoryId =
        signals.getOrDefault(SignalType.PERSISTENCE_20D, Collections.emptyMap());
    Map<String, BigDecimal> macroFitByCategoryId =
        signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap());
    Map<String, BigDecimal> momentumByCategoryId =
        signals.getOrDefault(SignalType.MOM, Collections.emptyMap());
    Map<String, Integer> signalDaysActiveByCategoryId =
        signalRepository.findSignalDaysActive(new java.math.BigDecimal("0.50"));
    Map<String, BigDecimal> realizedVol20dByCategoryId =
        signalRepository.findRealizedVolatility20d();
    Map<String, BigDecimal> scorePercentile252dByCategoryId =
        signalRepository.findScorePercentile252d();

    // Primary sort: timeframe RS signal; secondary: composite score (tiebreaker)
    var sortedRows =
        rows.stream()
            .sorted(
                Comparator.comparing(
                        (CategoryRepository.CategoryPriceRow row) ->
                            rsByCategory.getOrDefault(row.category().id().name(), BigDecimal.ZERO),
                        Comparator.<BigDecimal>reverseOrder())
                    .thenComparing(
                        row ->
                            compositeByCategoryId.getOrDefault(
                                row.category().id().name(), BigDecimal.ZERO),
                        Comparator.<BigDecimal>reverseOrder()))
            .toList();

    AtomicInteger rank = new AtomicInteger(1);
    var categorySummaryDtos =
        sortedRows.stream()
            .map(
                row ->
                    categoryMapper.toDto(
                        row,
                        rank.getAndIncrement(),
                        rsByCategory,
                        compositeByCategoryId,
                        rrgQuadrantByCategoryId,
                        compositeTrend5dByCategoryId,
                        compositeTrend10dByCategoryId,
                        compositeTrend20dByCategoryId,
                        rs120ByCategoryId,
                        rs20ByCategoryId,
                        flow20dByCategoryId,
                        persistence5dByCategoryId,
                        persistence20dByCategoryId,
                        macroFitByCategoryId,
                        momentumByCategoryId,
                        signalDaysActiveByCategoryId,
                        realizedVol20dByCategoryId,
                        scorePercentile252dByCategoryId))
            .toList();

    LocalDate asOfDate =
        sortedRows.stream()
            .map(r -> r.priceDate())
            .filter(d -> d != null)
            .max(Comparator.naturalOrder())
            .orElse(LocalDate.now());

    return new CategoriesResponse(asOfDate, timeframe, categorySummaryDtos);
  }

  public Map<String, List<Double>> getCompositeScoreHistory(int days) {
    int clamped = Math.max(5, Math.min(days, 120));
    Set<String> topLevelIds = categoryRepository.findTopLevelActiveCategoryIds();
    return signalRepository.findCompositeScoreHistory(clamped, topLevelIds).entrySet().stream()
        .collect(
            Collectors.toMap(
                Map.Entry::getKey,
                e ->
                    e.getValue().stream()
                        .map(v -> v == null ? null : v.doubleValue())
                        .collect(Collectors.toList())));
  }

  public List<PriceLevelDto> getPriceLevels() {
    return categoryRepository.findPriceLevels().stream()
        .map(
            r ->
                new PriceLevelDto(
                    r.categoryId(),
                    r.currentPrice(),
                    r.high252d(),
                    r.low252d(),
                    r.drawdownFromHigh(),
                    r.positionInRange(),
                    r.daysOfData()))
        .toList();
  }

  public List<SignalWinRateDto> getBuySignalWinRates(int lookbackDays) {
    int clamped = Math.max(90, Math.min(lookbackDays, 730));
    return signalRepository.findBuySignalWinRates(clamped).stream()
        .map(
            r ->
                new SignalWinRateDto(
                    r.categoryId(), r.signalCount(), r.winRate(), r.avgReturn30d()))
        .toList();
  }

  @Cacheable(value = "transitions-latest", key = "#lookbackDays")
  public List<SignalTransitionDto> getSignalTransitions(int lookbackDays) {
    int clamped = Math.max(1, Math.min(lookbackDays, 90));
    Map<String, Category> categoriesById =
        categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc().stream()
            .filter(c -> c.parentId() == null)
            .collect(Collectors.toMap(c -> c.id().name(), c -> c));

    Map<String, BigDecimal> scorePercentile252d = signalRepository.findScorePercentile252d();
    Map<String, Integer> signalDaysActive =
        signalRepository.findSignalDaysActive(new BigDecimal("0.50"));
    Map<String, BigDecimal> macroFitByCategory =
        signalRepository
            .findLatestByTypes(List.of(SignalType.MACRO_FIT))
            .getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap());

    return signalRepository.findSignalSnapshotPairs(clamped).stream()
        .map(
            pair -> {
              String currentRrg =
                  pair.currentRrg() != null ? String.valueOf(pair.currentRrg().intValue()) : null;
              String prevRrg =
                  pair.previousRrg() != null ? String.valueOf(pair.previousRrg().intValue()) : null;
              String currentSignal =
                  TradeSignalDeriver.derive(pair.currentScore(), currentRrg, pair.currentTrend());
              String previousSignal =
                  TradeSignalDeriver.derive(pair.previousScore(), prevRrg, pair.previousTrend());
              if (Objects.equals(currentSignal, previousSignal)) return null;
              Category cat = categoriesById.get(pair.categoryId());
              String categoryName = cat != null ? cat.name() : pair.categoryId();
              String etfTicker = cat != null ? cat.etfTicker() : "";
              int daysAgo =
                  pair.comparisonDate() != null
                      ? (int) ChronoUnit.DAYS.between(pair.comparisonDate(), LocalDate.now())
                      : clamped;
              BigDecimal pct = scorePercentile252d.get(pair.categoryId());
              BigDecimal fit = macroFitByCategory.get(pair.categoryId());
              Integer daysActive = signalDaysActive.get(pair.categoryId());
              // Simplified conviction (no trend5d/RS accel/flow/rs20 since those aren't fetched here)
              int conviction =
                  TradeSignalDeriver.convictionScore(
                      pair.currentScore(), currentRrg, pair.currentTrend(), fit, pct, null, null, null, null, null);
              return new SignalTransitionDto(
                  pair.categoryId(),
                  categoryName,
                  etfTicker,
                  previousSignal,
                  currentSignal,
                  pair.currentScore().doubleValue(),
                  pair.comparisonDate(),
                  daysAgo,
                  pct != null ? pct.doubleValue() : null,
                  fit != null ? fit.doubleValue() : null,
                  daysActive,
                  conviction > 0 ? conviction : null);
            })
        .filter(Objects::nonNull)
        .sorted(
            Comparator.comparing(t -> signalPriority(t.currentSignal()), Comparator.naturalOrder()))
        .toList();
  }

  private int signalPriority(String signal) {
    return switch (signal == null ? "" : signal) {
      case "BUY" -> 0;
      case "WATCH" -> 1;
      case "REDUCE" -> 2;
      default -> 3;
    };
  }

  private SignalType rsTypeForTimeframe(String timeframe) {
    return switch (timeframe == null ? "MONTH" : timeframe.toUpperCase()) {
      case "DAY", "WEEK" -> SignalType.RS_20;
      case "QUARTER", "YEAR" -> SignalType.RS_120;
      default -> SignalType.RS_60; // MONTH and unknown
    };
  }
}

package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.SignalType;
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
    List<SignalType> typesToFetch = List.of(
        rsType,
        SignalType.COMPOSITE,
        SignalType.RRG_QUADRANT,
        SignalType.COMPOSITE_TREND_5D,
        SignalType.COMPOSITE_TREND_10D,
        SignalType.COMPOSITE_TREND_20D,
        SignalType.RS_120,
        SignalType.FLOW_20D,
        SignalType.PERSISTENCE_20D);
    // Exclude duplicates when rsType is one of the already-listed types (e.g. RS_60 = default)
    var uniqueTypes = typesToFetch.stream().distinct().toList();
    Map<SignalType, Map<String, BigDecimal>> signals =
        signalRepository.findLatestByTypes(uniqueTypes);
    Map<String, BigDecimal> rsByCategory =
        signals.getOrDefault(rsType, Collections.emptyMap());
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
    Map<String, BigDecimal> flow20dByCategoryId =
        signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap());
    Map<String, BigDecimal> persistence20dByCategoryId =
        signals.getOrDefault(SignalType.PERSISTENCE_20D, Collections.emptyMap());

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
                        flow20dByCategoryId,
                        persistence20dByCategoryId))
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

  private SignalType rsTypeForTimeframe(String timeframe) {
    return switch (timeframe == null ? "MONTH" : timeframe.toUpperCase()) {
      case "DAY", "WEEK" -> SignalType.RS_20;
      case "QUARTER", "YEAR" -> SignalType.RS_120;
      default -> SignalType.RS_60; // MONTH and unknown
    };
  }
}

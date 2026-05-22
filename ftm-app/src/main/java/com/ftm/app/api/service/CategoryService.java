package com.ftm.app.api.service;

import com.ftm.app.api.dto.CategoriesResponse;
import com.ftm.app.api.mapper.CategoryMapper;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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
    Map<String, BigDecimal> rsByCategory = signalRepository.findLatestByType(rsType);
    Map<String, BigDecimal> compositeByCategoryId =
        signalRepository.findLatestByType(SignalType.COMPOSITE);
    Map<String, BigDecimal> rrgQuadrantByCategoryId =
        signalRepository.findLatestByType(SignalType.RRG_QUADRANT);
    Map<String, BigDecimal> compositeTrend5dByCategoryId =
        signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_5D);
    Map<String, BigDecimal> compositeTrend20dByCategoryId =
        signalRepository.findLatestByType(SignalType.COMPOSITE_TREND_20D);

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
                        compositeTrend20dByCategoryId))
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
    return signalRepository.findCompositeScoreHistory(clamped).entrySet().stream()
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

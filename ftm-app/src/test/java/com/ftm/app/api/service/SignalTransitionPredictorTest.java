package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.api.dto.ApproachingSignalDto;
import com.ftm.app.api.dto.CategorySummaryDto;
import com.ftm.app.domain.CategoryId;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class SignalTransitionPredictorTest {

  private final SignalTransitionPredictor predictor = new SignalTransitionPredictor();

  // ------------------------------------------------------------------ builders

  private CategorySummaryDto category(
      CategoryId id,
      BigDecimal score,
      BigDecimal trend5d,
      BigDecimal trend20d,
      String rrgQuadrant,
      String tradeSignal) {
    return new CategorySummaryDto(
        id, id.name(), "EQUITY_SECTOR", "ETF",
        score, trend5d, null, trend20d,
        rrgQuadrant, null, null, null, null,
        null, null, 1, null, LocalDate.now(),
        tradeSignal, null, null, null, null, null,
        null, null);
  }

  // ------------------------------------------------------------------ approaching BUY

  @Test
  @DisplayName("WATCH → BUY: projects days when momentum and improving quadrant align")
  void shouldProjectBuyTransitionForWatchCategory() {
    // score=0.58, trend5d=0.035 → velocity=0.007/day → gap=0.07 → 10 days to BUY
    var cat = category(CategoryId.GOLD, bd("0.58"), bd("0.035"), bd("0.01"), "4", "WATCH");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).projectedSignal()).isEqualTo("BUY");
    assertThat(result.get(0).currentSignal()).isEqualTo("WATCH");
    assertThat(result.get(0).estimatedDays()).isEqualTo(10);
    assertThat(result.get(0).confidence()).isEqualTo("MEDIUM");
  }

  @Test
  @DisplayName("approaching BUY within 7 days returns HIGH confidence")
  void shouldReturnHighConfidenceWhenLessThan7Days() {
    // score=0.62, trend5d=0.05 → velocity=0.010/day → gap=0.03 → 3 days
    var cat = category(CategoryId.HLTH, bd("0.62"), bd("0.05"), bd("0.02"), "3", "WATCH");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).confidence()).isEqualTo("HIGH");
    assertThat(result.get(0).estimatedDays()).isEqualTo(3);
  }

  // ------------------------------------------------------------------ approaching WATCH from HOLD

  @Test
  @DisplayName("HOLD → WATCH: rising HOLD category near 0.50 threshold projected")
  void shouldProjectWatchTransitionForHoldCategoryRising() {
    // score=0.44, trend5d=0.030 → velocity=0.006/day → gap=0.06 → 10 days
    var cat = category(CategoryId.TLTD, bd("0.44"), bd("0.030"), bd("0.01"), "3", "HOLD");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    // Could project either WATCH or BUY depending on thresholds; for score < 0.50, expect WATCH
    assertThat(result).isNotEmpty();
    assertThat(result.get(0).projectedSignal()).isEqualTo("WATCH");
  }

  // ------------------------------------------------------------------ BUY degrading

  @Test
  @DisplayName("BUY signal deteriorating: projects WATCH when score falling from BUY zone")
  void shouldProjectWatchWhenBuySignalDeteriorating() {
    // score=0.72, trend5d=-0.040 → velocity=-0.008/day → gap from 0.65=0.07 → 9 days to fall
    var cat = category(CategoryId.TECH, bd("0.72"), bd("-0.040"), bd("-0.015"), "1", "BUY");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).projectedSignal()).isEqualTo("WATCH");
    assertThat(result.get(0).currentSignal()).isEqualTo("BUY");
    assertThat(result.get(0).estimatedDays()).isEqualTo(9);
  }

  // ------------------------------------------------------------------ approaching REDUCE

  @Test
  @DisplayName("HOLD → REDUCE: falling category near 0.35 threshold in weakening quadrant")
  void shouldProjectReduceTransitionForWeakeningHold() {
    // score=0.42, trend5d=-0.035 → velocity=-0.007/day → gap=0.07 → 10 days to REDUCE
    var cat = category(CategoryId.ENRG, bd("0.42"), bd("-0.035"), bd("-0.015"), "2", "HOLD");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).projectedSignal()).isEqualTo("REDUCE");
    assertThat(result.get(0).currentSignal()).isEqualTo("HOLD");
  }

  // ------------------------------------------------------------------ exclusions

  @Test
  @DisplayName("excludes categories with null composite score")
  void shouldExcludeCategoriesWithNullScore() {
    var cat = category(CategoryId.CASH, null, bd("0.01"), null, null, null);

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("excludes categories with null trend5d")
  void shouldExcludeCategoriesWithNullTrend() {
    var cat = category(CategoryId.CASH, bd("0.55"), null, null, "4", "WATCH");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("excludes projections beyond 30 days")
  void shouldExcludeProjectionsBeyond30Days() {
    // score=0.58, trend5d=0.002 → velocity=0.0004/day → gap=0.07 → 175 days → excluded
    var cat = category(CategoryId.GOLD, bd("0.58"), bd("0.002"), bd("0.001"), "4", "WATCH");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("excludes zero velocity to avoid division by zero")
  void shouldExcludeZeroVelocityCategories() {
    var cat = category(CategoryId.HLTH, bd("0.58"), bd("0.000"), bd("0.000"), "4", "WATCH");

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    assertThat(result).isEmpty();
  }

  // ------------------------------------------------------------------ sort order

  @Test
  @DisplayName("results sorted by estimated days ascending")
  void shouldSortByEstimatedDaysAscending() {
    // GOLD: 3 days; HLTH: 10 days
    var gold = category(CategoryId.GOLD, bd("0.62"), bd("0.05"), bd("0.02"), "4", "WATCH"); // 3d
    var hlth = category(CategoryId.HLTH, bd("0.58"), bd("0.035"), bd("0.01"), "3", "WATCH"); // 10d

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(hlth, gold));

    assertThat(result).hasSizeGreaterThanOrEqualTo(2);
    assertThat(result.get(0).estimatedDays()).isLessThanOrEqualTo(result.get(1).estimatedDays());
  }

  // ------------------------------------------------------------------ empty input

  @Test
  @DisplayName("returns empty list when categories list is empty")
  void shouldReturnEmptyForEmptyInput() {
    assertThat(predictor.projectTransitions(List.of())).isEmpty();
  }

  // ------------------------------------------------------------------ derived signal fallback

  @Test
  @DisplayName("derives current signal from score/quadrant/trend when tradeSignal is null")
  void shouldDeriveSignalWhenTradeSignalIsNull() {
    // score=0.72, Q4, trend20d=+0.02 → derived BUY; trend5d=-0.040 → BUY degrading → projects WATCH
    var cat = category(CategoryId.MATL, bd("0.72"), bd("-0.040"), bd("0.02"), "4", null);

    List<ApproachingSignalDto> result = predictor.projectTransitions(List.of(cat));

    // BUY derived, falling → approaching WATCH
    assertThat(result).hasSize(1);
    assertThat(result.get(0).currentSignal()).isEqualTo("BUY");
    assertThat(result.get(0).projectedSignal()).isEqualTo("WATCH");
  }

  // ------------------------------------------------------------------ field accuracy

  @Test
  @DisplayName("populates categoryId, name, etfTicker, velocity correctly")
  void shouldPopulateFieldsCorrectly() {
    var cat = category(CategoryId.GOLD, bd("0.62"), bd("0.05"), bd("0.02"), "4", "WATCH");

    ApproachingSignalDto result = predictor.projectTransitions(List.of(cat)).get(0);

    assertThat(result.categoryId()).isEqualTo("GOLD");
    assertThat(result.categoryName()).isEqualTo("GOLD");
    assertThat(result.etfTicker()).isEqualTo("ETF");
    assertThat(result.dailyVelocity()).isPositive();
    assertThat(result.scoreGapToThreshold()).isNotNull();
  }

  private static BigDecimal bd(String val) {
    return new BigDecimal(val);
  }
}

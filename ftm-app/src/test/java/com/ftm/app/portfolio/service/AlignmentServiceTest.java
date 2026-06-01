package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AlignmentServiceTest {

  private AlignmentService alignmentService;

  @BeforeEach
  void setUp() {
    alignmentService = new AlignmentService();
  }

  @Test
  void portfolioExactlyMatchingOptimalReturnsMaxScore() {
    // composites sum to 1.0 → optimal = [50%, 30%, 20%]; actual matches exactly
    Map<String, BigDecimal> allocations =
        Map.of(
            "XLK", new BigDecimal("50"),
            "XLF", new BigDecimal("30"),
            "XLE", new BigDecimal("20"));
    Map<String, BigDecimal> compositeScores =
        Map.of(
            "XLK", new BigDecimal("0.50"),
            "XLF", new BigDecimal("0.30"),
            "XLE", new BigDecimal("0.20"));

    BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

    assertThat(score).isEqualByComparingTo(BigDecimal.ONE);
  }

  @Test
  void portfolioWithNoTrackedCategoriesReturnsZeroScore() {
    // 100% cash — no overlap with the composite universe
    Map<String, BigDecimal> allocations = Map.of("CASH", new BigDecimal("100"));
    Map<String, BigDecimal> compositeScores =
        Map.of(
            "XLK", new BigDecimal("0.80"),
            "XLF", new BigDecimal("0.60"),
            "XLE", new BigDecimal("0.40"));

    BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

    assertThat(score).isEqualByComparingTo(BigDecimal.ZERO);
  }

  @Test
  void partiallyMisalignedPortfolioReturnsExpectedScore() {
    // Universe optimal: XLK=40%, XLF=30%, XLV=20%, XLE=10% (composites sum to 2.00)
    // Actual swaps XLV/XLE positions:
    // overlap = min(40,40)+min(30,30)+min(20,10)+min(10,20) = 40+30+10+10 = 90 → 0.90
    Map<String, BigDecimal> allocations =
        Map.of(
            "XLK", new BigDecimal("40"),
            "XLF", new BigDecimal("30"),
            "XLE", new BigDecimal("20"),
            "XLV", new BigDecimal("10"));
    Map<String, BigDecimal> compositeScores =
        Map.of(
            "XLK", new BigDecimal("0.80"),
            "XLF", new BigDecimal("0.60"),
            "XLV", new BigDecimal("0.40"),
            "XLE", new BigDecimal("0.20"));

    BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

    assertThat(score.doubleValue()).isCloseTo(0.9, within(0.001));
  }

  @Test
  void categoriesWithNullCompositeScoreAreExcludedFromUniverse() {
    // Universe: XLK and XLF only (XLE null → excluded).
    // total=1.30; optimal: XLK≈61.5%, XLF≈38.5%.
    // actual: XLK=60, XLF=30 — overlap = min(60,61.5)+min(30,38.5) = 60+30 = 90 → 0.90.
    // XLE's 10% contributes 0 — correct cash-drag effect.
    Map<String, BigDecimal> allocations =
        Map.of(
            "XLK", new BigDecimal("60"),
            "XLF", new BigDecimal("30"),
            "XLE", new BigDecimal("10"));
    Map<String, BigDecimal> compositeScoresWithNull = new java.util.HashMap<>();
    compositeScoresWithNull.put("XLK", new BigDecimal("0.80"));
    compositeScoresWithNull.put("XLF", new BigDecimal("0.50"));
    compositeScoresWithNull.put("XLE", null);

    BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScoresWithNull);

    assertThat(score.doubleValue()).isCloseTo(0.9, within(0.001));
  }

  @Test
  void fewerThanTwoUniverseCategoriesReturnsZero() {
    Map<String, BigDecimal> allocations = Map.of("XLK", new BigDecimal("100"));
    Map<String, BigDecimal> compositeScores = Map.of("XLK", new BigDecimal("0.80"));

    BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

    assertThat(score).isEqualByComparingTo(BigDecimal.ZERO);
  }

  @Test
  void heavyCashPositionReducesAlignmentScore() {
    // Universe: XLK, XLF; total=1.30; optimal: XLK≈61.5%, XLF≈38.5%.
    // actual: XLK=30, XLF=15, CASH=55 (CASH not in universe → contributes 0).
    // overlap = min(30,61.5)+min(15,38.5) = 30+15 = 45 → score = 0.45 → PARTIAL.
    Map<String, BigDecimal> allocations = new java.util.HashMap<>();
    allocations.put("XLK", new BigDecimal("30"));
    allocations.put("XLF", new BigDecimal("15"));
    allocations.put("CASH", new BigDecimal("55"));

    Map<String, BigDecimal> compositeScores =
        Map.of(
            "XLK", new BigDecimal("0.80"),
            "XLF", new BigDecimal("0.50"));

    BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

    assertThat(score.doubleValue()).isCloseTo(0.45, within(0.001));
  }

  @Test
  void optimalAllocationIsProportionalToCompositeScore() {
    Map<String, BigDecimal> compositeScores =
        Map.of(
            "XLK", new BigDecimal("0.80"),
            "XLF", new BigDecimal("0.20"));

    Map<String, BigDecimal> optimal =
        alignmentService.computeCompositeOptimalAllocation(compositeScores);

    // XLK = 0.80/(0.80+0.20)*100 = 80%
    // XLF = 0.20/(0.80+0.20)*100 = 20%
    assertThat(optimal.get("XLK")).isEqualByComparingTo(new BigDecimal("80.00"));
    assertThat(optimal.get("XLF")).isEqualByComparingTo(new BigDecimal("20.00"));
  }

  @Test
  void optimalAllocationExcludesNullAndZeroCompositeScores() {
    Map<String, BigDecimal> compositeScoresWithNullAndZero = new java.util.HashMap<>();
    compositeScoresWithNullAndZero.put("XLK", new BigDecimal("0.80"));
    compositeScoresWithNullAndZero.put("XLF", null);
    compositeScoresWithNullAndZero.put("XLE", BigDecimal.ZERO);

    Map<String, BigDecimal> optimal =
        alignmentService.computeCompositeOptimalAllocation(compositeScoresWithNullAndZero);

    assertThat(optimal).containsOnlyKeys("XLK");
    assertThat(optimal.get("XLK")).isEqualByComparingTo(new BigDecimal("100.00"));
  }

  @Test
  void volatilityAdjustedAllocationFavorsLowerVolCategory() {
    // XLK: score=0.80, vol=0.30 → weight=2.667; XLF: score=0.80, vol=0.15 → weight=5.333
    // total=8.0; XLK=33.33%, XLF=66.67% — lower vol XLF gets double the allocation
    Map<String, BigDecimal> scores =
        Map.of("XLK", new BigDecimal("0.80"), "XLF", new BigDecimal("0.80"));
    Map<String, BigDecimal> vols =
        Map.of("XLK", new BigDecimal("0.30"), "XLF", new BigDecimal("0.15"));

    Map<String, BigDecimal> optimal =
        alignmentService.computeVolatilityAdjustedOptimalAllocation(scores, vols);

    assertThat(optimal.get("XLF").doubleValue())
        .isCloseTo(optimal.get("XLK").doubleValue() * 2, within(0.1));
  }

  @Test
  void volatilityAdjustedAllocationUsesDefaultVolWhenMissing() {
    // XLK: score=0.60, vol=0.20 → weight=3.0; XLF: score=0.60, vol=missing → default 10% → weight=6.0
    // XLF gets more allocation because its "effective" vol is lower than actual XLK vol
    Map<String, BigDecimal> scores =
        Map.of("XLK", new BigDecimal("0.60"), "XLF", new BigDecimal("0.60"));
    Map<String, BigDecimal> vols = Map.of("XLK", new BigDecimal("0.20"));

    Map<String, BigDecimal> optimal =
        alignmentService.computeVolatilityAdjustedOptimalAllocation(scores, vols);

    assertThat(optimal).containsOnlyKeys("XLK", "XLF");
    assertThat(optimal.get("XLK").doubleValue()).isCloseTo(33.33, within(0.5));
    assertThat(optimal.get("XLF").doubleValue()).isCloseTo(66.67, within(0.5));
  }

  @Test
  void volatilityAdjustedAllocationFloorsVolAtFivePercent() {
    // vol=0.02 should be floored to 0.05; weight=score/0.05
    Map<String, BigDecimal> scores =
        Map.of("XLK", new BigDecimal("0.50"), "XLF", new BigDecimal("0.50"));
    Map<String, BigDecimal> vols =
        Map.of("XLK", new BigDecimal("0.02"), "XLF", new BigDecimal("0.05"));

    Map<String, BigDecimal> optimal =
        alignmentService.computeVolatilityAdjustedOptimalAllocation(scores, vols);

    // Both floored/at-floor → equal weights
    assertThat(optimal.get("XLK").doubleValue()).isCloseTo(50.0, within(0.5));
    assertThat(optimal.get("XLF").doubleValue()).isCloseTo(50.0, within(0.5));
  }

  @Test
  void volatilityAdjustedAllocationReturnsEmptyWhenNoPositiveScores() {
    Map<String, BigDecimal> scores = new java.util.HashMap<>();
    scores.put("XLK", null);
    scores.put("XLF", BigDecimal.ZERO);

    Map<String, BigDecimal> optimal =
        alignmentService.computeVolatilityAdjustedOptimalAllocation(scores, Map.of());

    assertThat(optimal).isEmpty();
  }
}

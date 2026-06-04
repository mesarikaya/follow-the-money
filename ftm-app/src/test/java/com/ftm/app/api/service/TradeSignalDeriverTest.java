package com.ftm.app.api.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TradeSignalDeriverTest {

  @Test
  @DisplayName("returns null when composite score is null")
  void shouldReturnNullWhenScoreIsNull() {
    assertThat(TradeSignalDeriver.derive(null, "4", new BigDecimal("0.01"))).isNull();
  }

  @Test
  @DisplayName("returns BUY when score >= 0.65, quadrant improving (4), trend positive")
  void shouldReturnBuyWhenAllConditionsMet() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.75"), "4", new BigDecimal("0.02")))
        .isEqualTo("BUY");
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.65"), "3", new BigDecimal("0.01")))
        .isEqualTo("BUY");
  }

  @Test
  @DisplayName("returns WATCH when score >= 0.50 and improving quadrant, even if trend is negative")
  void shouldReturnWatchWhenScoreAndQuadrantMeetThreshold() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.60"), "4", new BigDecimal("-0.01")))
        .isEqualTo("WATCH");
  }

  @Test
  @DisplayName("returns WATCH when score >= 0.50 and trend positive, even if quadrant is lagging")
  void shouldReturnWatchWhenScoreAndTrendMeetThreshold() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.55"), "1", new BigDecimal("0.01")))
        .isEqualTo("WATCH");
  }

  @Test
  @DisplayName("returns REDUCE when score < 0.35 and quadrant is weakening (1 or 2)")
  void shouldReturnReduceWhenScoreLowAndQuadrantWeakening() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.30"), "1", null)).isEqualTo("REDUCE");
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.34"), "2", new BigDecimal("-0.02")))
        .isEqualTo("REDUCE");
  }

  @Test
  @DisplayName("returns HOLD when score is mid-range with no directional signal")
  void shouldReturnHoldForMidRangeScore() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.45"), "1", new BigDecimal("-0.01")))
        .isEqualTo("HOLD");
  }

  @Test
  @DisplayName("returns HOLD when score < 0.35 but quadrant is not weakening")
  void shouldReturnHoldWhenScoreLowButQuadrantImproving() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.30"), "4", null)).isEqualTo("HOLD");
  }

  @Test
  @DisplayName("returns BUY at exact 0.65 boundary with quadrant 3 and positive trend")
  void shouldReturnBuyAtExactBuyThreshold() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.65"), "3", new BigDecimal("0.001")))
        .isEqualTo("BUY");
  }

  @Test
  @DisplayName("does not return BUY when score is exactly 0.65 but trend is missing")
  void shouldNotReturnBuyWhenTrendMissing() {
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.65"), "3", null)).isEqualTo("WATCH");
  }

  @Test
  @DisplayName("handles null rrgQuadrant without throwing")
  void shouldHandleNullRrgQuadrant() {
    // score 0.60, no quadrant, trending — WATCH via trend
    assertThat(TradeSignalDeriver.derive(new BigDecimal("0.60"), null, new BigDecimal("0.01")))
        .isEqualTo("WATCH");
  }

  @Test
  @DisplayName("convictionScore returns 0 for HOLD signal")
  void convictionScoreShouldBeZeroForHold() {
    int score =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.45"),
            "1",
            new BigDecimal("-0.01"),
            null,
            null,
            null,
            null,
            null,
            null,
            null);
    assertThat(score).isEqualTo(0);
  }

  @Test
  @DisplayName("convictionScore returns 0 when composite score is null")
  void convictionScoreShouldBeZeroWhenScoreNull() {
    assertThat(
            TradeSignalDeriver.convictionScore(
                null,
                "4",
                new BigDecimal("0.02"),
                new BigDecimal("0.80"),
                new BigDecimal("0.90"),
                new BigDecimal("0.03"),
                null,
                null,
                null,
                null))
        .isEqualTo(0);
  }

  @Test
  @DisplayName("convictionScore is positive for a fully-confirmed BUY signal")
  void convictionScoreShouldBeHighForStrongBuy() {
    int conviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.82"), // strong score → 20 pts
            "4", // Leading quadrant (BUY confirmed) → 30 pts
            new BigDecimal("0.03"), // 20d trend positive
            new BigDecimal("0.80"), // macro aligned → 18 pts
            new BigDecimal("0.88"), // top percentile → 15 pts
            new BigDecimal("0.07"), // 5d trend > 20d by >0.02 → 12 pts accel
            new BigDecimal("0.65"), // rs60
            new BigDecimal("0.62"), // rs120 → rs accel > 0.003 → 5 pts
            null, // no flow data
            null); // no rs20 data
    assertThat(conviction).isGreaterThanOrEqualTo(70);
    assertThat(conviction).isLessThanOrEqualTo(100);
  }

  @Test
  @DisplayName("convictionScore is capped at 100")
  void convictionScoreShouldBeCappedAt100() {
    // All signals at maximum values including strong flow
    int conviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.95"),
            "4",
            new BigDecimal("0.05"),
            new BigDecimal("0.90"),
            new BigDecimal("0.95"),
            new BigDecimal("0.10"),
            new BigDecimal("0.70"),
            new BigDecimal("0.65"),
            new BigDecimal("2.5"), // flow z-score > 1.5 → would add 5 pts but cap holds
            null); // rs20 null
    assertThat(conviction).isEqualTo(100);
  }

  @Test
  @DisplayName("convictionScore WATCH with only 1 BUY condition returns 0")
  void convictionScoreWatchWithOneBuyConditionReturnsZero() {
    // score 0.60 (< BUY threshold), quadrant 1 (lagging), trend positive → WATCH with 1 condition
    int conviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.60"),
            "1",
            new BigDecimal("0.01"),
            new BigDecimal("0.70"),
            new BigDecimal("0.75"),
            new BigDecimal("0.01"),
            null,
            null,
            null,
            null);
    assertThat(conviction).isEqualTo(0);
  }

  @Test
  @DisplayName("convictionScore BUY with strong institutional inflows adds 5 points")
  void convictionScoreShouldAddFlowBonusForBuyWithHighFlowZ() {
    // BUY signal, score 0.70, reasonable signals — no flow
    int baseConviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.70"),
            "4",
            new BigDecimal("0.02"),
            new BigDecimal("0.60"),
            new BigDecimal("0.70"),
            new BigDecimal("0.03"),
            new BigDecimal("0.10"),
            new BigDecimal("0.09"),
            null,
            null);

    // Same BUY signal with strong flow z = 2.0 (above 1.5 threshold)
    int withFlowConviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.70"),
            "4",
            new BigDecimal("0.02"),
            new BigDecimal("0.60"),
            new BigDecimal("0.70"),
            new BigDecimal("0.03"),
            new BigDecimal("0.10"),
            new BigDecimal("0.09"),
            new BigDecimal("2.0"),
            null);

    assertThat(withFlowConviction).isEqualTo(baseConviction + 5);
  }

  @Test
  @DisplayName("convictionScore REDUCE with strong outflows adds 5 points")
  void convictionScoreShouldAddFlowBonusForReduceWithNegativeFlowZ() {
    // REDUCE signal: score < 0.35, weakening quadrant
    int baseConviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.28"),
            "1",
            new BigDecimal("-0.02"),
            new BigDecimal("0.30"),
            new BigDecimal("0.25"),
            new BigDecimal("-0.01"),
            null,
            null,
            null,
            null);

    int withFlowConviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.28"),
            "1",
            new BigDecimal("-0.02"),
            new BigDecimal("0.30"),
            new BigDecimal("0.25"),
            new BigDecimal("-0.01"),
            null,
            null,
            new BigDecimal("-2.0"),
            null); // flow z = -2.0 (below -1.5 threshold)

    assertThat(withFlowConviction).isEqualTo(baseConviction + 5);
  }

  @Test
  @DisplayName("convictionScore BUY with RS-20 > RS-60 > RS-120 all-aligned adds 5 points")
  void convictionScoreShouldAddRs20AlignedBonusForBuyWithAllRsAligned() {
    // BUY signal, rs60=0.05, rs120=0.02 (rs accel > 0.003 → 5 pts for accel), no flow
    int baseConviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.70"),
            "4",
            new BigDecimal("0.02"),
            new BigDecimal("0.60"),
            new BigDecimal("0.70"),
            new BigDecimal("0.03"),
            new BigDecimal("0.05"),
            new BigDecimal("0.02"),
            null,
            null);

    // Same but with RS-20 = 0.08 > RS-60 = 0.05 > RS-120 = 0.02 — all aligned bullish → +5 pts
    int withRs20Conviction =
        TradeSignalDeriver.convictionScore(
            new BigDecimal("0.70"),
            "4",
            new BigDecimal("0.02"),
            new BigDecimal("0.60"),
            new BigDecimal("0.70"),
            new BigDecimal("0.03"),
            new BigDecimal("0.05"),
            new BigDecimal("0.02"),
            null,
            new BigDecimal("0.08"));

    assertThat(withRs20Conviction).isEqualTo(baseConviction + 5);
  }
}

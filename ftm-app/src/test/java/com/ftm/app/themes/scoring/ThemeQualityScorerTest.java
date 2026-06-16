package com.ftm.app.themes.scoring;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ThemeQualityScorerTest {

  private static final Offset<Double> DELTA = Offset.offset(0.001);

  private final ThemeQualityScorer scorer =
      new ThemeQualityScorer(
          List.of(
              new SignalStrengthCriterion(),
              new ConvictionCriterion(),
              new StabilityCriterion(),
              new MomentumCriterion(),
              new CapitalFlowCriterion()));

  private ThemeScoreContext context(
      Double compositeScore,
      int signalStreakDays,
      Double volatility30d,
      Double compositeTrend20d,
      Double flow20d) {
    return new ThemeScoreContext(
        compositeScore, signalStreakDays, volatility30d, compositeTrend20d, flow20d);
  }

  @Test
  @DisplayName("returns null when compositeScore is null")
  void shouldReturnNullWhenScoreIsNull() {
    ThemeScoreContext ctx = context(null, 0, null, null, null);
    assertThat(scorer.computeScore(ctx)).isNull();
  }

  @Test
  @DisplayName("weights sum to 1.0 so max score equals max criterion score")
  void shouldWeightsSumToOne() {
    double totalWeight =
        new SignalStrengthCriterion().weight()
            + new ConvictionCriterion().weight()
            + new StabilityCriterion().weight()
            + new MomentumCriterion().weight()
            + new CapitalFlowCriterion().weight();
    assertThat(totalWeight).isCloseTo(1.0, DELTA);
  }

  @Test
  @DisplayName("perfect theme scores near 1.0 — maxed signal, streak ≥ 20d, zero volatility, positive trend and flow")
  void shouldScoreNearOneForPerfectTheme() {
    ThemeScoreContext ctx = context(1.0, 20, 0.0, 0.04, 2.0);
    Double score = scorer.computeScore(ctx);
    assertThat(score).isNotNull().isCloseTo(1.0, DELTA);
  }

  @Test
  @DisplayName("weak theme with zero score and maxed negative inputs scores near zero")
  void shouldScoreNearZeroForWeakTheme() {
    ThemeScoreContext ctx = context(0.0, 0, 0.10, -0.04, -2.0);
    Double score = scorer.computeScore(ctx);
    assertThat(score).isNotNull().isLessThan(0.10);
  }

  @Test
  @DisplayName("conviction saturates at streak ≥ 20 days — longer streaks have no extra benefit")
  void shouldCapConvictionAtTwentyDays() {
    ThemeScoreContext ctx20 = context(0.70, 20, 0.05, 0.01, 0.5);
    ThemeScoreContext ctx40 = context(0.70, 40, 0.05, 0.01, 0.5);
    assertThat(scorer.computeScore(ctx20)).isCloseTo(scorer.computeScore(ctx40), DELTA);
  }

  @Test
  @DisplayName("null flow and trend default to 0.5 neutral — equal to a theme with zero values in those signals")
  void shouldUseNeutralDefaultForNullFlowAndTrend() {
    ThemeScoreContext withNulls = context(0.60, 10, 0.02, null, null);
    ThemeScoreContext withZeroTrendAndNeutralFlow = context(0.60, 10, 0.02, 0.0, 0.0);
    assertThat(scorer.computeScore(withNulls))
        .isCloseTo(scorer.computeScore(withZeroTrendAndNeutralFlow), DELTA);
  }

  @Test
  @DisplayName("high volatility theme scores lower than identical low-volatility theme")
  void shouldPenalizeHighVolatility() {
    ThemeScoreContext lowVol = context(0.65, 15, 0.01, 0.01, 0.8);
    ThemeScoreContext highVol = context(0.65, 15, 0.08, 0.01, 0.8);
    assertThat(scorer.computeScore(lowVol)).isGreaterThan(scorer.computeScore(highVol));
  }

  @Test
  @DisplayName("BUY-zone theme with 15-day streak and stable vol scores above 0.70")
  void shouldScoreAboveSeventyForQualityBuyTheme() {
    ThemeScoreContext ctx = context(0.72, 15, 0.022, 0.012, 1.1);
    Double score = scorer.computeScore(ctx);
    assertThat(score).isNotNull().isGreaterThan(0.70);
  }
}

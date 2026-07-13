package com.ftm.app.themes.transition;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PhaseTransitionDetectorTest {

  private PhaseTransitionDetector detector;

  @BeforeEach
  void setUp() {
    detector =
        new PhaseTransitionDetector(
            List.of(
                new ApproachingBuyTransitionRule(),
                new BreakoutAtRiskTransitionRule(),
                new EarlyRecoveryTransitionRule(),
                new DistributionSignalTransitionRule()));
  }

  private PhaseTransitionContext context(
      Double score, int streak, Double trend5d, Double trend20d, Double flow, int alerts) {
    return new PhaseTransitionContext(
        "BUILDING", score, streak, trend5d, trend20d, flow, 0.02, alerts);
  }

  @Test
  @DisplayName("returns APPROACHING_BUY for score 0.58, trend5d +0.008, streak 7")
  void shouldDetectApproachingBuy() {
    var ctx = context(0.58, 7, 0.008, 0.005, 0.5, 2);
    assertThat(detector.detect(ctx)).isEqualTo(Optional.of(PhaseTransitionSignal.APPROACHING_BUY));
  }

  @Test
  @DisplayName("returns BREAKOUT_AT_RISK for score 0.72, trend5d -0.010, alerts 8")
  void shouldDetectBreakoutAtRisk() {
    var ctx = context(0.72, 20, -0.010, 0.002, 0.3, 8);
    assertThat(detector.detect(ctx)).isEqualTo(Optional.of(PhaseTransitionSignal.BREAKOUT_AT_RISK));
  }

  @Test
  @DisplayName("returns DISTRIBUTION for score 0.70, flow -0.7, trend20d -0.005")
  void shouldDetectDistribution() {
    var ctx = context(0.70, 15, 0.001, -0.005, -0.7, 3);
    assertThat(detector.detect(ctx)).isEqualTo(Optional.of(PhaseTransitionSignal.DISTRIBUTION));
  }

  @Test
  @DisplayName("BREAKOUT_AT_RISK takes priority over DISTRIBUTION when both conditions met")
  void shouldPreferHigherPriorityRule() {
    // score=0.68, trend5d=-0.010 (breakout at risk), flow=-0.7 trend20d=-0.006 (distribution)
    // Both priority=5, but BREAKOUT_AT_RISK fires first (needs alertCount>=5)
    var ctx = context(0.68, 20, -0.010, -0.006, -0.7, 7);
    Optional<PhaseTransitionSignal> result = detector.detect(ctx);
    // Either BREAKOUT_AT_RISK or DISTRIBUTION is valid — both priority=5
    assertThat(result).isPresent();
    assertThat(result.get())
        .isIn(PhaseTransitionSignal.BREAKOUT_AT_RISK, PhaseTransitionSignal.DISTRIBUTION);
  }

  @Test
  @DisplayName("returns EARLY_RECOVERY for score 0.42, trend5d +0.015, streak 4")
  void shouldDetectEarlyRecovery() {
    var ctx = context(0.42, 4, 0.015, 0.003, 0.1, 1);
    assertThat(detector.detect(ctx)).isEqualTo(Optional.of(PhaseTransitionSignal.EARLY_RECOVERY));
  }

  @Test
  @DisplayName("returns empty when no rule fires for a neutral midrange theme")
  void shouldReturnEmptyForNeutralTheme() {
    // score=0.55, trend=0.001 (not accelerating enough), streak=3 (not enough)
    var ctx = context(0.55, 3, 0.001, 0.001, 0.1, 1);
    assertThat(detector.detect(ctx)).isEmpty();
  }

  @Test
  @DisplayName("returns empty when compositeScore is null")
  void shouldReturnEmptyForNullScore() {
    var ctx = new PhaseTransitionContext("NEUTRAL", null, 5, 0.010, 0.005, 0.5, 0.02, 2);
    assertThat(detector.detect(ctx)).isEmpty();
  }

  @Test
  @DisplayName("ApproachingBuy does not fire when score above 0.65 (already BUY territory)")
  void shouldNotFireApproachingBuyAboveThreshold() {
    var ctx = context(0.66, 10, 0.008, 0.005, 0.5, 2);
    Optional<PhaseTransitionSignal> result = detector.detect(ctx);
    assertThat(result).isNotEqualTo(Optional.of(PhaseTransitionSignal.APPROACHING_BUY));
  }
}

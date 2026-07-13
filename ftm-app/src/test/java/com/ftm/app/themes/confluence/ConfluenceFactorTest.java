package com.ftm.app.themes.confluence;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.themes.entry.EntryAction;
import com.ftm.app.themes.transition.PhaseTransitionSignal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ConfluenceFactorTest {

  @Nested
  class EntryTimingFactorTests {

    private final EntryTimingFactor factor = new EntryTimingFactor();

    @Test
    @DisplayName("ENTER scores +3")
    void enterScoresPositive() {
      assertThat(factor.score(input(EntryAction.ENTER, null, null, null))).isEqualTo(3);
    }

    @Test
    @DisplayName("SCALE_IN scores +2 — constructive, but less than a full entry")
    void scaleInScoresPositive() {
      assertThat(factor.score(input(EntryAction.SCALE_IN, null, null, null))).isEqualTo(2);
    }

    @Test
    @DisplayName("WATCH scores 0")
    void watchScoresNeutral() {
      assertThat(factor.score(input(EntryAction.WATCH, null, null, null))).isEqualTo(0);
    }

    @Test
    @DisplayName("AVOID scores -3")
    void avoidScoresNegative() {
      assertThat(factor.score(input(EntryAction.AVOID, null, null, null))).isEqualTo(-3);
    }

    @Test
    @DisplayName("no entry action scores 0")
    void noActionScoresNeutral() {
      assertThat(factor.score(input(null, null, null, null))).isEqualTo(0);
    }

    @Test
    @DisplayName("weight is 0.35")
    void weight() {
      assertThat(factor.weight()).isEqualTo(0.35);
    }
  }

  @Nested
  class RiskLevelFactorTests {

    private final RiskLevelFactor factor = new RiskLevelFactor();

    @Test
    @DisplayName("LOW scores +2")
    void lowScoresPositive() {
      assertThat(factor.score(input(null, "LOW", null, null))).isEqualTo(2);
    }

    @Test
    @DisplayName("MEDIUM scores +1")
    void mediumScoresLow() {
      assertThat(factor.score(input(null, "MEDIUM", null, null))).isEqualTo(1);
    }

    @Test
    @DisplayName("HIGH scores -1")
    void highScoresNegative() {
      assertThat(factor.score(input(null, "HIGH", null, null))).isEqualTo(-1);
    }

    @Test
    @DisplayName("EXTREME scores -3")
    void extremeScoresVeryNegative() {
      assertThat(factor.score(input(null, "EXTREME", null, null))).isEqualTo(-3);
    }

    @Test
    @DisplayName("weight is 0.25")
    void weight() {
      assertThat(factor.weight()).isEqualTo(0.25);
    }
  }

  @Nested
  class MomentumAlignmentFactorTests {

    private final MomentumAlignmentFactor factor = new MomentumAlignmentFactor();

    @Test
    @DisplayName("ALIGNED_BULLISH scores +2")
    void alignedBullish() {
      assertThat(factor.score(input(null, null, "ALIGNED_BULLISH", null))).isEqualTo(2);
    }

    @Test
    @DisplayName("RECOVERING scores +1")
    void recovering() {
      assertThat(factor.score(input(null, null, "RECOVERING", null))).isEqualTo(1);
    }

    @Test
    @DisplayName("NEUTRAL scores 0")
    void neutral() {
      assertThat(factor.score(input(null, null, "NEUTRAL", null))).isEqualTo(0);
    }

    @Test
    @DisplayName("FADING scores -1")
    void fading() {
      assertThat(factor.score(input(null, null, "FADING", null))).isEqualTo(-1);
    }

    @Test
    @DisplayName("ALIGNED_BEARISH scores -2")
    void alignedBearish() {
      assertThat(factor.score(input(null, null, "ALIGNED_BEARISH", null))).isEqualTo(-2);
    }

    @Test
    @DisplayName("null alignment scores 0")
    void nullAlignment() {
      assertThat(factor.score(input(null, null, null, null))).isEqualTo(0);
    }

    @Test
    @DisplayName("weight is 0.25")
    void weight() {
      assertThat(factor.weight()).isEqualTo(0.25);
    }
  }

  @Nested
  class PhaseTransitionFactorTests {

    private final PhaseTransitionFactor factor = new PhaseTransitionFactor();

    @Test
    @DisplayName("APPROACHING_BUY scores +2")
    void approachingBuy() {
      assertThat(factor.score(input(null, null, null, PhaseTransitionSignal.APPROACHING_BUY)))
          .isEqualTo(2);
    }

    @Test
    @DisplayName("EARLY_RECOVERY scores +1")
    void earlyRecovery() {
      assertThat(factor.score(input(null, null, null, PhaseTransitionSignal.EARLY_RECOVERY)))
          .isEqualTo(1);
    }

    @Test
    @DisplayName("BREAKOUT_AT_RISK scores -2")
    void breakoutAtRisk() {
      assertThat(factor.score(input(null, null, null, PhaseTransitionSignal.BREAKOUT_AT_RISK)))
          .isEqualTo(-2);
    }

    @Test
    @DisplayName("DISTRIBUTION scores -2")
    void distribution() {
      assertThat(factor.score(input(null, null, null, PhaseTransitionSignal.DISTRIBUTION)))
          .isEqualTo(-2);
    }

    @Test
    @DisplayName("null transition scores 0")
    void nullTransition() {
      assertThat(factor.score(input(null, null, null, null))).isEqualTo(0);
    }

    @Test
    @DisplayName("weight is 0.15")
    void weight() {
      assertThat(factor.weight()).isEqualTo(0.15);
    }
  }

  private static ConfluenceInput input(
      EntryAction entryAction,
      String riskLevel,
      String momentumAlignment,
      PhaseTransitionSignal phaseTransitionSignal) {
    return new ConfluenceInput(entryAction, riskLevel, momentumAlignment, phaseTransitionSignal);
  }
}

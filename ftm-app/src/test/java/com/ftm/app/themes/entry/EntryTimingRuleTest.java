package com.ftm.app.themes.entry;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.themes.entry.rules.ApproachingBuyWatchRule;
import com.ftm.app.themes.entry.rules.AvoidExtremeRiskRule;
import com.ftm.app.themes.entry.rules.BreakoutEntryRule;
import com.ftm.app.themes.entry.rules.DipBuyRule;
import com.ftm.app.themes.entry.rules.HighVolatilityScaleRule;
import com.ftm.app.themes.entry.rules.SteadyUptrendRule;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class EntryTimingRuleTest {

  private static EntryTimingContext ctx(
      String phase,
      double score,
      String riskLevel,
      Double trend5d,
      Double trend20d) {
    return new EntryTimingContext(phase, score, riskLevel, trend5d, trend20d);
  }

  @Nested
  class AvoidExtremeRiskRuleTests {

    private final AvoidExtremeRiskRule rule = new AvoidExtremeRiskRule();

    @Test
    @DisplayName("EXTREME risk level → AVOID")
    void extremeRiskTriggersAvoid() {
      var result = rule.evaluate(ctx("BUILDING", 0.70, "EXTREME", 0.01, 0.01));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.AVOID);
    }

    @Test
    @DisplayName("WEAK phase → AVOID regardless of risk level")
    void weakPhaseTriggersAvoid() {
      var result = rule.evaluate(ctx("WEAK", 0.40, "MEDIUM", -0.01, -0.01));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.AVOID);
    }

    @Test
    @DisplayName("DISTRIBUTE phase → AVOID")
    void distributePhaseTriggersAvoid() {
      var result = rule.evaluate(ctx("DISTRIBUTE", 0.66, "HIGH", -0.005, -0.003));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.AVOID);
    }

    @Test
    @DisplayName("BREAKOUT phase with LOW risk → no match")
    void breakoutWithLowRiskNoMatch() {
      assertThat(rule.evaluate(ctx("BREAKOUT", 0.72, "LOW", 0.015, 0.008))).isEmpty();
    }
  }

  @Nested
  class BreakoutEntryRuleTests {

    private final BreakoutEntryRule rule = new BreakoutEntryRule();

    @Test
    @DisplayName("score>=0.65, strong trends, LOW risk → ENTER")
    void fullBreakoutCondition() {
      var result = rule.evaluate(ctx("BREAKOUT", 0.72, "LOW", 0.015, 0.008));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.ENTER);
    }

    @Test
    @DisplayName("score below BUY threshold → no match")
    void belowBuyThreshold() {
      assertThat(rule.evaluate(ctx("BUILDING", 0.60, "LOW", 0.015, 0.008))).isEmpty();
    }

    @Test
    @DisplayName("weak trend5d → no match")
    void weakTrend5d() {
      assertThat(rule.evaluate(ctx("BREAKOUT", 0.72, "LOW", 0.005, 0.008))).isEmpty();
    }

    @Test
    @DisplayName("HIGH risk level → no match")
    void highRiskPreventsEntry() {
      assertThat(rule.evaluate(ctx("BREAKOUT", 0.72, "HIGH", 0.015, 0.008))).isEmpty();
    }
  }

  @Nested
  class DipBuyRuleTests {

    private final DipBuyRule rule = new DipBuyRule();

    @Test
    @DisplayName("in BUY zone, short-term dip, 20d positive, safe risk → SCALE_IN")
    void dipInUptrendIsScaleIn() {
      var result = rule.evaluate(ctx("MOMENTUM", 0.68, "LOW", -0.008, 0.006));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.SCALE_IN);
    }

    @Test
    @DisplayName("20d trend also negative → no match (not a healthy dip)")
    void bothNegativeTrendsNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.68, "LOW", -0.008, -0.003))).isEmpty();
    }

    @Test
    @DisplayName("5d trend positive → no match (not a dip)")
    void positiveShortTermNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.68, "LOW", 0.008, 0.006))).isEmpty();
    }
  }

  @Nested
  class HighVolatilityScaleRuleTests {

    private final HighVolatilityScaleRule rule = new HighVolatilityScaleRule();

    @Test
    @DisplayName("in BUY zone with HIGH risk → SCALE_IN")
    void highVolatilityBuyZoneScalesIn() {
      var result = rule.evaluate(ctx("MOMENTUM", 0.70, "HIGH", 0.005, 0.003));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.SCALE_IN);
    }

    @Test
    @DisplayName("MEDIUM risk in BUY zone → no match (better handled by breakout rule)")
    void mediumRiskNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.70, "MEDIUM", 0.005, 0.003))).isEmpty();
    }

    @Test
    @DisplayName("below BUY threshold → no match")
    void belowBuyThresholdNoMatch() {
      assertThat(rule.evaluate(ctx("BUILDING", 0.60, "HIGH", 0.005, 0.003))).isEmpty();
    }
  }

  @Nested
  class ApproachingBuyWatchRuleTests {

    private final ApproachingBuyWatchRule rule = new ApproachingBuyWatchRule();

    @Test
    @DisplayName("score 0.55-0.65 with positive 5d trend → WATCH")
    void approachingBuyReturnsWatch() {
      var result = rule.evaluate(ctx("BUILDING", 0.60, "MEDIUM", 0.006, 0.003));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.WATCH);
    }

    @Test
    @DisplayName("score below watch band → no match")
    void belowWatchBandNoMatch() {
      assertThat(rule.evaluate(ctx("BUILDING", 0.50, "MEDIUM", 0.006, 0.003))).isEmpty();
    }

    @Test
    @DisplayName("score already in BUY zone → no match")
    void inBuyZoneNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.70, "MEDIUM", 0.006, 0.003))).isEmpty();
    }

    @Test
    @DisplayName("negative 5d trend → no match")
    void negativeMomentumNoMatch() {
      assertThat(rule.evaluate(ctx("BUILDING", 0.60, "MEDIUM", -0.005, 0.003))).isEmpty();
    }
  }

  @Nested
  class SteadyUptrendRuleTests {

    private final SteadyUptrendRule rule = new SteadyUptrendRule();

    @Test
    @DisplayName("BUY zone, calm positive 5d and 20d, safe risk → ENTER")
    void calmBuyZoneReturnsEnter() {
      var result = rule.evaluate(ctx("MOMENTUM", 0.70, "MEDIUM", 0.005, 0.003));
      assertThat(result).isPresent();
      assertThat(result.get().action()).isEqualTo(EntryAction.ENTER);
    }

    @Test
    @DisplayName("score below BUY threshold → no match")
    void belowBuyThresholdNoMatch() {
      assertThat(rule.evaluate(ctx("BUILDING", 0.60, "LOW", 0.005, 0.003))).isEmpty();
    }

    @Test
    @DisplayName("HIGH risk → no match (only LOW/MEDIUM are safe)")
    void highRiskNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.70, "HIGH", 0.005, 0.003))).isEmpty();
    }

    @Test
    @DisplayName("negative 5d trend → no match (not calm)")
    void negative5dTrendNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.70, "MEDIUM", -0.002, 0.003))).isEmpty();
    }

    @Test
    @DisplayName("negative 20d trend → no match (not stable long-term)")
    void negative20dTrendNoMatch() {
      assertThat(rule.evaluate(ctx("MOMENTUM", 0.70, "MEDIUM", 0.005, -0.001))).isEmpty();
    }
  }
}

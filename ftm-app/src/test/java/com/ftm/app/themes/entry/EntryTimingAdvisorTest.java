package com.ftm.app.themes.entry;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.themes.entry.rules.ApproachingBuyWatchRule;
import com.ftm.app.themes.entry.rules.AvoidExtremeRiskRule;
import com.ftm.app.themes.entry.rules.BreakoutEntryRule;
import com.ftm.app.themes.entry.rules.DipBuyRule;
import com.ftm.app.themes.entry.rules.HighVolatilityScaleRule;
import com.ftm.app.themes.entry.rules.SteadyUptrendRule;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class EntryTimingAdvisorTest {

  private EntryTimingAdvisor advisor;

  @BeforeEach
  void setUp() {
    advisor =
        new EntryTimingAdvisor(
            List.of(
                new AvoidExtremeRiskRule(),
                new BreakoutEntryRule(),
                new DipBuyRule(),
                new HighVolatilityScaleRule(),
                new SteadyUptrendRule(),
                new ApproachingBuyWatchRule()));
  }

  private EntryTimingContext context(
      String phase, double score, String riskLevel, Double trend5d, Double trend20d) {
    return new EntryTimingContext(phase, score, riskLevel, trend5d, trend20d);
  }

  @Test
  @DisplayName("avoid rule priority=100 beats dip-buy priority=70 when both match")
  void avoidOutranksMatchingDipBuyRule() {
    // DISTRIBUTE phase → AvoidExtremeRiskRule fires (priority=100)
    // trend5d<-0.005, trend20d>0, score≥0.65, risk=LOW → DipBuyRule also fires (priority=70)
    // Both match; priority ordering must ensure AVOID wins, not SCALE_IN
    EntryTimingContext ctx = context("DISTRIBUTE", 0.70, "LOW", -0.008, 0.006);
    var result = advisor.advise(ctx);
    assertThat(result).isPresent();
    assertThat(result.get().action()).isEqualTo(EntryAction.AVOID);
  }

  @Test
  @DisplayName("steady uptrend fills gap for calm BUY-zone momentum (trend5d in [0, 0.01))")
  void steadyUptrendFillsBuyZoneGap() {
    // Previously: score=0.70, trend5d=0.005 (below Breakout=0.010), not a dip, risk MEDIUM
    // → no rule matched, entryAction was null (silent gap)
    // SteadyUptrendRule (priority=50) now catches this
    EntryTimingContext ctx = context("MOMENTUM", 0.70, "MEDIUM", 0.005, 0.003);
    var result = advisor.advise(ctx);
    assertThat(result).isPresent();
    assertThat(result.get().action()).isEqualTo(EntryAction.ENTER);
  }

  @Test
  @DisplayName("breakout entry on strong momentum with safe risk")
  void breakoutEntryOnStrongMomentum() {
    EntryTimingContext ctx = context("MOMENTUM", 0.72, "LOW", 0.015, 0.008);
    var result = advisor.advise(ctx);
    assertThat(result).isPresent();
    assertThat(result.get().action()).isEqualTo(EntryAction.ENTER);
  }

  @Test
  @DisplayName("dip buy fires when short-term dip in healthy uptrend")
  void dipBuyOnShortTermPullback() {
    EntryTimingContext ctx = context("MOMENTUM", 0.68, "MEDIUM", -0.008, 0.006);
    var result = advisor.advise(ctx);
    assertThat(result).isPresent();
    assertThat(result.get().action()).isEqualTo(EntryAction.SCALE_IN);
  }

  @Test
  @DisplayName("high volatility scale rule fires for BUY zone with HIGH risk")
  void scaleInForHighVolatility() {
    EntryTimingContext ctx = context("MOMENTUM", 0.70, "HIGH", 0.005, 0.003);
    var result = advisor.advise(ctx);
    assertThat(result).isPresent();
    assertThat(result.get().action()).isEqualTo(EntryAction.SCALE_IN);
  }

  @Test
  @DisplayName("watch recommendation for approaching BUY zone with positive momentum")
  void watchOnApproachingBuyZone() {
    EntryTimingContext ctx = context("BUILDING", 0.60, "MEDIUM", 0.006, 0.004);
    var result = advisor.advise(ctx);
    assertThat(result).isPresent();
    assertThat(result.get().action()).isEqualTo(EntryAction.WATCH);
  }

  @Test
  @DisplayName("no recommendation for low score with no positive momentum")
  void noRecommendationWhenNoRuleMatches() {
    EntryTimingContext ctx = context("BUILDING", 0.40, "MEDIUM", -0.003, 0.001);
    var result = advisor.advise(ctx);
    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("empty rule list returns no recommendation")
  void emptyRuleListReturnsEmpty() {
    EntryTimingAdvisor emptyAdvisor = new EntryTimingAdvisor(List.of());
    EntryTimingContext ctx = context("BREAKOUT", 0.75, "LOW", 0.020, 0.012);
    assertThat(emptyAdvisor.advise(ctx)).isEmpty();
  }
}

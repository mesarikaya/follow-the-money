package com.ftm.app.themes.risk;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ThemeRiskAggregatorTest {

  private ThemeRiskAggregator aggregator;

  @BeforeEach
  void setUp() {
    aggregator =
        new ThemeRiskAggregator(
            List.of(
                new VolatilityRiskDimension(),
                new TrendDecayRiskDimension(),
                new AlertDensityRiskDimension(),
                new PhaseRiskDimension()));
  }

  private ThemeRiskContext context(
      String phase,
      Double score,
      Double volatility,
      Double trend5d,
      Double trend20d,
      int alerts,
      int streak) {
    return new ThemeRiskContext(phase, score, volatility, trend5d, trend20d, alerts, streak);
  }

  @Test
  @DisplayName("all LOW dimensions → aggregate returns LOW")
  void shouldReturnLowWhenAllDimensionsLow() {
    // BREAKOUT phase, low volatility, both trends positive, zero alerts
    ThemeRiskContext ctx = context("BREAKOUT", 0.75, 0.005, 0.012, 0.008, 0, 15);
    assertThat(aggregator.aggregate(ctx)).isEqualTo(ThemeRiskLevel.LOW);
  }

  @Test
  @DisplayName("one EXTREME dimension drives aggregate to EXTREME")
  void shouldEscalateToExtremeWhenOneExtremePresent() {
    // BREAKOUT phase (LOW phase risk) but extreme volatility
    ThemeRiskContext ctx = context("BREAKOUT", 0.75, 0.050, 0.012, 0.008, 0, 10);
    assertThat(aggregator.aggregate(ctx)).isEqualTo(ThemeRiskLevel.EXTREME);
  }

  @Test
  @DisplayName("WEAK phase alone drives aggregate to EXTREME")
  void shouldReturnExtremeForWeakPhase() {
    ThemeRiskContext ctx = context("WEAK", 0.25, 0.008, -0.003, -0.002, 2, 0);
    assertThat(aggregator.aggregate(ctx)).isEqualTo(ThemeRiskLevel.EXTREME);
  }

  @Test
  @DisplayName("high alert density drives aggregate to at least HIGH")
  void shouldReturnHighForAlertDensity() {
    ThemeRiskContext ctx = context("MOMENTUM", 0.70, 0.012, 0.005, 0.003, 10, 20);
    ThemeRiskLevel result = aggregator.aggregate(ctx);
    assertThat(result.ordinal()).isGreaterThanOrEqualTo(ThemeRiskLevel.HIGH.ordinal());
  }

  @Test
  @DisplayName("DISTRIBUTE phase + negative trends + moderate volatility → HIGH or above")
  void shouldReturnHighForDistributingTheme() {
    ThemeRiskContext ctx = context("DISTRIBUTE", 0.68, 0.022, -0.006, -0.004, 5, 8);
    ThemeRiskLevel result = aggregator.aggregate(ctx);
    assertThat(result.ordinal()).isGreaterThanOrEqualTo(ThemeRiskLevel.HIGH.ordinal());
  }

  @Test
  @DisplayName("null volatility and null trends fall back to MEDIUM defaults")
  void shouldHandleNullFieldsGracefully() {
    ThemeRiskContext ctx = context("BUILDING", 0.55, null, null, null, 1, 5);
    ThemeRiskLevel result = aggregator.aggregate(ctx);
    assertThat(result).isNotNull();
    assertThat(result).isEqualTo(ThemeRiskLevel.MEDIUM);
  }

  @Test
  @DisplayName("empty dimension list returns MEDIUM fallback")
  void shouldReturnMediumFallbackForNoDimensions() {
    ThemeRiskAggregator empty = new ThemeRiskAggregator(List.of());
    ThemeRiskContext ctx = context("BREAKOUT", 0.75, 0.005, 0.010, 0.005, 0, 10);
    assertThat(empty.aggregate(ctx)).isEqualTo(ThemeRiskLevel.MEDIUM);
  }
}

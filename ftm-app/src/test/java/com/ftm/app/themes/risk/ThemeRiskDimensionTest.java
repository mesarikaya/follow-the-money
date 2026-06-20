package com.ftm.app.themes.risk;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ThemeRiskDimensionTest {

  private static ThemeRiskContext ctx(
      String phase,
      Double volatility,
      Double trend5d,
      Double trend20d,
      int alerts) {
    return new ThemeRiskContext(phase, 0.55, volatility, trend5d, trend20d, alerts, 5);
  }

  @Nested
  class VolatilityDimension {

    private final VolatilityRiskDimension dimension = new VolatilityRiskDimension();

    @Test
    @DisplayName("null volatility → MEDIUM")
    void nullVolatility() {
      assertThat(dimension.evaluate(ctx("BUILDING", null, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.MEDIUM);
    }

    @Test
    @DisplayName("volatility 0.005 → LOW")
    void lowVolatility() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.005, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.LOW);
    }

    @Test
    @DisplayName("volatility 0.030 → HIGH")
    void highVolatility() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.030, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.HIGH);
    }

    @Test
    @DisplayName("volatility 0.050 → EXTREME")
    void extremeVolatility() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.050, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.EXTREME);
    }
  }

  @Nested
  class TrendDecayDimension {

    private final TrendDecayRiskDimension dimension = new TrendDecayRiskDimension();

    @Test
    @DisplayName("both strongly positive trends → LOW")
    void positivetrends() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, 0.010, 0.005, 0)))
          .isEqualTo(ThemeRiskLevel.LOW);
    }

    @Test
    @DisplayName("extreme dual decline → EXTREME")
    void extremeDecline() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, -0.020, -0.015, 0)))
          .isEqualTo(ThemeRiskLevel.EXTREME);
    }

    @Test
    @DisplayName("both negative but not extreme → HIGH")
    void bothNegative() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, -0.005, -0.003, 0)))
          .isEqualTo(ThemeRiskLevel.HIGH);
    }

    @Test
    @DisplayName("null both trends → MEDIUM")
    void nullTrends() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, null, null, 0)))
          .isEqualTo(ThemeRiskLevel.MEDIUM);
    }
  }

  @Nested
  class AlertDensityDimension {

    private final AlertDensityRiskDimension dimension = new AlertDensityRiskDimension();

    @Test
    @DisplayName("0 alerts → LOW")
    void noAlerts() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.LOW);
    }

    @Test
    @DisplayName("8 alerts → HIGH")
    void highAlerts() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, 0.0, 0.0, 8)))
          .isEqualTo(ThemeRiskLevel.HIGH);
    }

    @Test
    @DisplayName("15 alerts → EXTREME")
    void extremeAlerts() {
      assertThat(dimension.evaluate(ctx("BUILDING", 0.01, 0.0, 0.0, 15)))
          .isEqualTo(ThemeRiskLevel.EXTREME);
    }
  }

  @Nested
  class PhaseDimension {

    private final PhaseRiskDimension dimension = new PhaseRiskDimension();

    @Test
    @DisplayName("BREAKOUT phase → LOW")
    void breakoutPhase() {
      assertThat(dimension.evaluate(ctx("BREAKOUT", 0.01, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.LOW);
    }

    @Test
    @DisplayName("FADING phase → HIGH")
    void fadingPhase() {
      assertThat(dimension.evaluate(ctx("FADING", 0.01, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.HIGH);
    }

    @Test
    @DisplayName("WEAK phase → EXTREME")
    void weakPhase() {
      assertThat(dimension.evaluate(ctx("WEAK", 0.01, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.EXTREME);
    }

    @Test
    @DisplayName("unknown phase → MEDIUM")
    void unknownPhase() {
      assertThat(dimension.evaluate(ctx("UNKNOWN", 0.01, 0.0, 0.0, 0)))
          .isEqualTo(ThemeRiskLevel.MEDIUM);
    }
  }
}

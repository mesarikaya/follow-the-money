package com.ftm.app.themes.rotation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import com.ftm.app.api.dto.ThemeSummaryDto;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class CapitalRotationMetricTest {

  private static ThemeSummaryDto theme(Double score, Double trend20d) {
    return new ThemeSummaryDto(
        "ID", "Name", "Thesis", 3, score, null, null, null, trend20d,
        0, "BUY", null, "MOMENTUM", List.of(), 0, 0, null, null, null,
        null, "MEDIUM", null, null, null, 50, "MODERATE");
  }

  @Nested
  class ScoreDispersionMetricTests {

    private final ScoreDispersionMetric metric = new ScoreDispersionMetric();

    @Test
    @DisplayName("fewer than 4 themes with scores → 0.0")
    void tooFewThemes() {
      assertThat(metric.compute(List.of(theme(0.80, 0.01), theme(0.40, -0.01))))
          .isCloseTo(0.0, offset(0.001));
    }

    @Test
    @DisplayName("all themes same score → 0.0 dispersion")
    void noDispersion() {
      List<ThemeSummaryDto> flat = List.of(
          theme(0.60, 0.01), theme(0.60, 0.01), theme(0.60, -0.01), theme(0.60, 0.01));
      assertThat(metric.compute(flat)).isCloseTo(0.0, offset(0.001));
    }

    @Test
    @DisplayName("max spread scores → dispersion close to 1.0")
    void highDispersion() {
      List<ThemeSummaryDto> spread = List.of(
          theme(0.10, -0.02), theme(0.20, -0.01), theme(0.80, 0.01), theme(0.90, 0.02));
      // Q1=0.175, Q3=0.825, IQR=0.65 → normalized 0.65/0.5 → capped at 1.0
      assertThat(metric.compute(spread)).isCloseTo(1.0, offset(0.001));
    }

    @Test
    @DisplayName("moderate spread → dispersion between 0 and 1")
    void moderateDispersion() {
      List<ThemeSummaryDto> themes = List.of(
          theme(0.40, -0.01), theme(0.50, 0.00), theme(0.65, 0.01), theme(0.75, 0.02));
      // Q1=0.475, Q3=0.70, IQR=0.225 → 0.225/0.5 = 0.45
      double result = metric.compute(themes);
      assertThat(result).isGreaterThan(0.0).isLessThan(1.0);
    }

    @Test
    @DisplayName("themes with null scores are excluded")
    void nullScoresExcluded() {
      List<ThemeSummaryDto> themes = List.of(
          theme(null, 0.01), theme(0.40, 0.01), theme(0.60, 0.01), theme(0.80, 0.01));
      // Only 3 non-null scores → below threshold → 0.0
      assertThat(metric.compute(themes)).isCloseTo(0.0, offset(0.001));
    }

    @Test
    @DisplayName("metric name and weight are correct")
    void metricMetadata() {
      assertThat(metric.metricName()).isEqualTo("SCORE_DISPERSION");
      assertThat(metric.weight()).isCloseTo(0.60, offset(0.001));
    }
  }

  @Nested
  class TrendAlignmentMetricTests {

    private final TrendAlignmentMetric metric = new TrendAlignmentMetric();

    @Test
    @DisplayName("perfect alignment: winners trending up, losers trending down → 1.0")
    void perfectAlignment() {
      List<ThemeSummaryDto> themes = List.of(
          theme(0.80, 0.01),  // above midpoint + trending up → aligned
          theme(0.70, 0.01),  // aligned
          theme(0.30, -0.01), // below midpoint + trending down → aligned
          theme(0.20, -0.01)  // aligned
      );
      assertThat(metric.compute(themes)).isCloseTo(1.0, offset(0.001));
    }

    @Test
    @DisplayName("no alignment: winners trending down, losers trending up → 0.0")
    void noAlignment() {
      List<ThemeSummaryDto> themes = List.of(
          theme(0.80, -0.01), // above midpoint but trending down → misaligned
          theme(0.70, -0.01), // misaligned
          theme(0.30, 0.01),  // below midpoint but trending up → misaligned
          theme(0.20, 0.01)   // misaligned
      );
      assertThat(metric.compute(themes)).isCloseTo(0.0, offset(0.001));
    }

    @Test
    @DisplayName("flat trend (within threshold) is neither aligned nor misaligned")
    void flatTrendIgnored() {
      List<ThemeSummaryDto> themes = List.of(
          theme(0.80, 0.001), // above midpoint, flat (within ±0.002) → not aligned
          theme(0.30, 0.001)  // below midpoint, flat → not aligned
      );
      assertThat(metric.compute(themes)).isCloseTo(0.0, offset(0.001));
    }

    @Test
    @DisplayName("no eligible themes → 0.0")
    void noEligibleThemes() {
      List<ThemeSummaryDto> themes = List.of(
          theme(null, 0.01), theme(0.80, null));
      assertThat(metric.compute(themes)).isCloseTo(0.0, offset(0.001));
    }

    @Test
    @DisplayName("metric name and weight are correct")
    void metricMetadata() {
      assertThat(metric.metricName()).isEqualTo("TREND_ALIGNMENT");
      assertThat(metric.weight()).isCloseTo(0.40, offset(0.001));
    }
  }
}

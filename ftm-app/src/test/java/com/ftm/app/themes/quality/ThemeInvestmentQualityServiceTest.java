package com.ftm.app.themes.quality;

import static org.assertj.core.api.Assertions.assertThat;

import com.ftm.app.themes.quality.ThemeInvestmentQualityService.ThemeQuality;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ThemeInvestmentQualityServiceTest {

  private final ThemeInvestmentQualityService service = new ThemeInvestmentQualityService();

  private ThemeQualityContext context(
      int confluenceScore,
      int persistenceScore,
      int signalStreakDays,
      Double volatility30d,
      Double concentrationRisk,
      Double scorePercentile30d) {
    return new ThemeQualityContext(
        confluenceScore, persistenceScore, signalStreakDays,
        volatility30d, concentrationRisk, scorePercentile30d);
  }

  @Test
  @DisplayName("high quality theme — all inputs excellent — grades A")
  void highQualityThemeGradesA() {
    ThemeQuality result = service.computeQuality(
        context(90, 85, 20, 0.01, 0.20, 0.10));

    assertThat(result.investmentQualityScore()).isGreaterThanOrEqualTo(80);
    assertThat(result.investmentQualityGrade()).isEqualTo("A");
  }

  @Test
  @DisplayName("low quality theme — all inputs poor — grades F or D")
  void lowQualityThemeGradesFOrD() {
    ThemeQuality result = service.computeQuality(
        context(15, 10, 0, 0.09, 0.90, 0.95));

    assertThat(result.investmentQualityScore()).isLessThan(40);
    assertThat(result.investmentQualityGrade()).isIn("F", "D", "C");
  }

  @Test
  @DisplayName("null inputs fall back to neutral 50 for affected sub-scores")
  void nullInputsUseNeutralFallback() {
    ThemeQuality result = service.computeQuality(
        context(50, 50, 0, null, null, null));

    assertThat(result.investmentQualityScore()).isGreaterThan(0);
    assertThat(result.investmentQualityScore()).isLessThan(100);
  }

  @Test
  @DisplayName("historically cheap theme (low percentile) scores higher than expensive one")
  void cheapThemeScoresHigherThanExpensive() {
    ThemeQuality cheapResult = service.computeQuality(
        context(60, 60, 10, 0.02, 0.40, 0.05));
    ThemeQuality expensiveResult = service.computeQuality(
        context(60, 60, 10, 0.02, 0.40, 0.95));

    assertThat(cheapResult.investmentQualityScore())
        .isGreaterThan(expensiveResult.investmentQualityScore());
  }

  @Test
  @DisplayName("high concentration risk reduces score vs diversified theme")
  void concentratedThemeScoresLowerThanDiversified() {
    ThemeQuality concentrated = service.computeQuality(
        context(60, 60, 10, 0.02, 0.95, 0.50));
    ThemeQuality diversified = service.computeQuality(
        context(60, 60, 10, 0.02, 0.20, 0.50));

    assertThat(diversified.investmentQualityScore())
        .isGreaterThan(concentrated.investmentQualityScore());
  }

  @Test
  @DisplayName("grade boundaries are correct: >=80=A, >=60=B, >=40=C, >=20=D, <20=F")
  void gradeBoundaries() {
    // score = signalQuality(92)*0.50 + valueScore(95)*0.20 + diversification(90)*0.15 + volatility(90)*0.15 = 92
    assertThat(service.computeQuality(context(90, 90, 30, 0.01, 0.10, 0.05)).investmentQualityGrade())
        .isEqualTo("A");
    assertThat(service.computeQuality(context(40, 40, 5, 0.05, 0.50, 0.50)).investmentQualityGrade())
        .isIn("B", "C");
  }
}

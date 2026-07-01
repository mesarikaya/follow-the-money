package com.ftm.app.themes.signal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.data.Offset.offset;

import com.ftm.app.api.dto.ThemeConstituentDto;
import com.ftm.app.signals.repository.SignalRepository.DateHistory;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ThemeSignalCalculatorsTest {

  @Nested
  @DisplayName("ThemeSignalStreakCounter")
  class StreakCounterTests {

    private final ThemeSignalStreakCounter counter = new ThemeSignalStreakCounter();
    private final LocalDate base = LocalDate.of(2025, 6, 1);

    @Test
    @DisplayName("returns 0 for empty history")
    void returnsZeroForEmptyHistory() {
      assertThat(counter.count(List.of(), "BUY")).isEqualTo(0);
    }

    @Test
    @DisplayName("counts consecutive BUY days from end of history")
    void countsConsecutiveBuyStreak() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(2), 0.50, null, null),
              new DateHistory(base.minusDays(1), 0.72, null, null),
              new DateHistory(base, 0.78, null, null));
      assertThat(counter.count(history, "BUY")).isEqualTo(2);
    }

    @Test
    @DisplayName("breaks streak when a different signal appears")
    void breaksOnSignalChange() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(3), 0.80, null, null),
              new DateHistory(base.minusDays(2), 0.80, null, null),
              new DateHistory(base.minusDays(1), 0.45, null, null),
              new DateHistory(base, 0.80, null, null));
      assertThat(counter.count(history, "BUY")).isEqualTo(1);
    }

    @Test
    @DisplayName("full streak when all history matches current signal")
    void fullStreakWhenAllMatch() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(2), 0.80, null, null),
              new DateHistory(base.minusDays(1), 0.75, null, null),
              new DateHistory(base, 0.78, null, null));
      assertThat(counter.count(history, "BUY")).isEqualTo(3);
    }
  }

  @Nested
  @DisplayName("ThemeVolatilityCalculator")
  class VolatilityCalculatorTests {

    private final ThemeVolatilityCalculator calculator = new ThemeVolatilityCalculator();
    private final LocalDate base = LocalDate.of(2025, 6, 1);

    @Test
    @DisplayName("returns null for fewer than 3 history points")
    void returnsNullForInsufficientHistory() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(1), 0.60, null, null),
              new DateHistory(base, 0.65, null, null));
      assertThat(calculator.calculate(history)).isNull();
    }

    @Test
    @DisplayName("returns null for empty history")
    void returnsNullForEmpty() {
      assertThat(calculator.calculate(List.of())).isNull();
    }

    @Test
    @DisplayName("computes standard deviation of daily score changes")
    void computesStandardDeviation() {
      // scores: [0.60, 0.62, 0.58] → changes: [+0.02, -0.04] → mean=-0.01, stdev=0.030
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(2), 0.60, null, null),
              new DateHistory(base.minusDays(1), 0.62, null, null),
              new DateHistory(base, 0.58, null, null));
      assertThat(calculator.calculate(history)).isCloseTo(0.030, offset(0.001));
    }

    @Test
    @DisplayName("returns 0 for constant score (no volatility)")
    void returnsZeroForFlatHistory() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(2), 0.60, null, null),
              new DateHistory(base.minusDays(1), 0.60, null, null),
              new DateHistory(base, 0.60, null, null));
      assertThat(calculator.calculate(history)).isCloseTo(0.0, offset(0.0001));
    }
  }

  @Nested
  @DisplayName("ThemeScorePercentileCalculator")
  class ScorePercentileCalculatorTests {

    private final ThemeScorePercentileCalculator calculator = new ThemeScorePercentileCalculator();
    private final LocalDate base = LocalDate.of(2025, 6, 1);

    @Test
    @DisplayName("returns null for empty history")
    void returnsNullForEmpty() {
      assertThat(calculator.calculate(List.of(), 0.70)).isNull();
    }

    @Test
    @DisplayName("returns null when currentScore is null")
    void returnsNullForNullScore() {
      List<DateHistory> history = List.of(new DateHistory(base, 0.60, null, null));
      assertThat(calculator.calculate(history, null)).isNull();
    }

    @Test
    @DisplayName("computes percentile as fraction of history below current score")
    void computesPercentile() {
      // score=0.75; history=[0.60, 0.65, 0.70, 0.80]; 3 below → 3/4=0.75
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(3), 0.60, null, null),
              new DateHistory(base.minusDays(2), 0.65, null, null),
              new DateHistory(base.minusDays(1), 0.70, null, null),
              new DateHistory(base, 0.80, null, null));
      assertThat(calculator.calculate(history, 0.75)).isCloseTo(0.75, offset(0.001));
    }

    @Test
    @DisplayName("returns 0 when current score is below all history")
    void returnsZeroWhenLowestScore() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(1), 0.80, null, null),
              new DateHistory(base, 0.90, null, null));
      assertThat(calculator.calculate(history, 0.50)).isCloseTo(0.0, offset(0.001));
    }
  }

  @Nested
  @DisplayName("ThemeConcentrationRiskCalculator")
  class ConcentrationRiskCalculatorTests {

    private final ThemeConcentrationRiskCalculator calculator =
        new ThemeConcentrationRiskCalculator();

    private ThemeConstituentDto constituent(String categoryId, String parentCategoryId) {
      return new ThemeConstituentDto(
          categoryId, parentCategoryId, categoryId, "", null, null, null, null, null, "HOLD", null);
    }

    @Test
    @DisplayName("returns null for empty constituents")
    void returnsNullForEmpty() {
      assertThat(calculator.calculate(List.of())).isNull();
    }

    @Test
    @DisplayName("returns 1.0 when all constituents share one parent sector")
    void returnsOneWhenFullConcentration() {
      List<ThemeConstituentDto> constituents =
          List.of(constituent("SEMI", "TECH"), constituent("AIRO", "TECH"));
      assertThat(calculator.calculate(constituents)).isCloseTo(1.0, offset(0.001));
    }

    @Test
    @DisplayName("returns 0.5 when constituents are split equally across two parent sectors")
    void returnsHalfWhenEvenSplit() {
      List<ThemeConstituentDto> constituents =
          List.of(constituent("SEMI", "TECH"), constituent("BANK", "FINL"));
      assertThat(calculator.calculate(constituents)).isCloseTo(0.5, offset(0.001));
    }

    @Test
    @DisplayName("uses categoryId as parent when parentCategoryId is null")
    void usesCategoryIdWhenNoParent() {
      List<ThemeConstituentDto> constituents =
          List.of(constituent("SEMI", null), constituent("SEMI2", null));
      // Each uses its own categoryId → 2 different parents → max=1 → 1/2=0.5
      assertThat(calculator.calculate(constituents)).isCloseTo(0.5, offset(0.001));
    }
  }

  @Nested
  @DisplayName("ThemePhaseHistoryService")
  class PhaseHistoryServiceTests {

    private final ThemePhaseHistoryService service =
        new ThemePhaseHistoryService(new ThemePhaseClassifier());
    private final LocalDate base = LocalDate.of(2025, 6, 1);

    @Test
    @DisplayName("computeHistory returns empty list for empty history")
    void returnsEmptyForNoHistory() {
      assertThat(service.computeHistory(List.of())).isEmpty();
    }

    @Test
    @DisplayName("computeHistory classifies each day using ThemePhaseClassifier")
    void classifiesEachDayIndependently() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(1), 0.70, 0.008, 0.005),
              new DateHistory(base, 0.30, null, null));
      List<String> phases = service.computeHistory(history);
      assertThat(phases).hasSize(2);
      assertThat(phases.get(0)).isEqualTo("MOMENTUM");
      assertThat(phases.get(1)).isEqualTo("WEAK");
    }

    @Test
    @DisplayName("computePhaseStreak returns 0 for empty history")
    void returnsZeroStreakForEmptyHistory() {
      assertThat(service.computePhaseStreak(List.of(), "MOMENTUM")).isEqualTo(0);
    }

    @Test
    @DisplayName("computePhaseStreak counts consecutive matching phases from end")
    void countsConsecutiveMatchingPhases() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(3), 0.40, null, null),
              new DateHistory(base.minusDays(2), 0.70, 0.008, 0.005),
              new DateHistory(base.minusDays(1), 0.72, 0.009, 0.006),
              new DateHistory(base, 0.71, 0.007, 0.005));
      int streak = service.computePhaseStreak(history, "MOMENTUM");
      assertThat(streak).isEqualTo(3);
    }

    @Test
    @DisplayName("computePhaseStreak breaks on phase change")
    void breaksOnPhaseChange() {
      List<DateHistory> history =
          List.of(
              new DateHistory(base.minusDays(2), 0.70, 0.008, 0.005),
              new DateHistory(base.minusDays(1), 0.30, null, null),
              new DateHistory(base, 0.70, 0.008, 0.005));
      int streak = service.computePhaseStreak(history, "MOMENTUM");
      assertThat(streak).isEqualTo(1);
    }
  }

  @Nested
  @DisplayName("ThemePhaseClassifier")
  class PhaseClassifierTests {

    private final ThemePhaseClassifier classifier = new ThemePhaseClassifier();

    @Test
    @DisplayName("returns NEUTRAL when score is null")
    void returnsNeutralForNullScore() {
      assertThat(classifier.classify(null, null, null, null)).isEqualTo("NEUTRAL");
    }

    @Test
    @DisplayName("returns BREAKOUT for high score with accelerating trend")
    void returnsBreakoutForHighScoreAndAcceleration() {
      assertThat(classifier.classify(0.70, 0.020, 0.010, null)).isEqualTo("BREAKOUT");
    }

    @Test
    @DisplayName("returns MOMENTUM for high score with positive 20d trend")
    void returnsMomentumForHighScoreAndTrend() {
      assertThat(classifier.classify(0.70, null, 0.010, null)).isEqualTo("MOMENTUM");
    }

    @Test
    @DisplayName("returns HOLDING for high score with no trend signals")
    void returnsHoldingForHighScoreNoTrend() {
      assertThat(classifier.classify(0.70, null, null, null)).isEqualTo("HOLDING");
    }

    @Test
    @DisplayName("returns DISTRIBUTE for high score with outflow and no acceleration")
    void returnsDistributeForHighScoreAndOutflow() {
      assertThat(classifier.classify(0.70, null, null, -0.6)).isEqualTo("DISTRIBUTE");
    }

    @Test
    @DisplayName("returns SETUP for mid score with acceleration and inflow")
    void returnsSetupForMidScoreAndAccelerationInflow() {
      assertThat(classifier.classify(0.55, 0.015, 0.005, 0.5)).isEqualTo("SETUP");
    }

    @Test
    @DisplayName("returns FADING for mid score with negative trend")
    void returnsFadingForMidScoreNegativeTrend() {
      assertThat(classifier.classify(0.55, null, -0.010, null)).isEqualTo("FADING");
    }

    @Test
    @DisplayName("returns WEAK for low score below 0.35")
    void returnsWeakForVeryLowScore() {
      assertThat(classifier.classify(0.30, null, null, null)).isEqualTo("WEAK");
    }

    @Test
    @DisplayName("returns NEUTRAL for mid-low score without trend signals")
    void returnsNeutralForMidLowScore() {
      assertThat(classifier.classify(0.40, null, null, null)).isEqualTo("NEUTRAL");
    }
  }
}

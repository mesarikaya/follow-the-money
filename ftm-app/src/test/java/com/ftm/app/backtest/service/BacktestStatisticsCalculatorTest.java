package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BacktestStatisticsCalculatorTest {

  BacktestStatisticsCalculator calculator;

  @BeforeEach
  void setUp() {
    calculator = new BacktestStatisticsCalculator();
  }

  // ── computeSortinoRatio ──────────────────────────────────────────────────────

  @Test
  @DisplayName("sortino: returns 0 for empty curve")
  void sortinoReturnsZeroForEmptyCurve() {
    assertThat(calculator.computeSortinoRatio(List.of(), false)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: returns 0 for single-point curve")
  void sortinoReturnsZeroForSinglePoint() {
    var curve = List.of(point("2023-01-01", 10_000, 10_000));
    assertThat(calculator.computeSortinoRatio(curve, false)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: returns 0 when there are no negative returns (pure uptrend)")
  void sortinoReturnsZeroWhenNoNegativeReturns() {
    // monotonically increasing — downside deviation = 0 → ratio undefined → return 0
    var curve =
        List.of(
            point("2023-01-01", 10_000, 9_000),
            point("2023-01-02", 10_100, 9_100),
            point("2023-01-03", 10_200, 9_200));
    assertThat(calculator.computeSortinoRatio(curve, false)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: positive for strategy with mean positive return and some downside days")
  void sortinoIsPositiveForPositiveMeanReturn() {
    // Portfolio goes up 2% then down 1% then up 2%: mean > 0, downside > 0 → sortino > 0
    var curve =
        List.of(
            point("2023-01-01", 10_000, 10_000),
            point("2023-01-02", 10_200, 10_200),
            point("2023-01-03", 10_098, 10_098),
            point("2023-01-04", 10_300, 10_300));
    assertThat(calculator.computeSortinoRatio(curve, false)).isGreaterThan(0.0);
  }

  @Test
  @DisplayName("sortino: negative for strategy with mean negative return")
  void sortinoIsNegativeForNegativeMeanReturn() {
    var curve =
        List.of(
            point("2023-01-01", 10_000, 10_000),
            point("2023-01-02", 9_800, 9_800),
            point("2023-01-03", 9_600, 9_600));
    assertThat(calculator.computeSortinoRatio(curve, false)).isLessThan(0.0);
  }

  @Test
  @DisplayName("sortino: spy mode uses spyValue column, not portfolioValue")
  void sortinoSpyModeUsesSpyValues() {
    // portfolio flat, spy moves up → spy sortino should be 0 (no downside days)
    var curve =
        List.of(
            point("2023-01-01", 10_000, 10_000),
            point("2023-01-02", 10_000, 10_200),
            point("2023-01-03", 10_000, 10_400));
    assertThat(calculator.computeSortinoRatio(curve, true)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: portfolio and spy sortinos differ when paths diverge")
  void sortinoPortfolioAndSpyDifferWhenPathsDiverge() {
    // portfolio volatile (up/down/up), spy smooth uptrend
    var curve =
        List.of(
            point("2023-01-01", 10_000, 10_000),
            point("2023-01-02", 10_300, 10_100),
            point("2023-01-03", 9_900, 10_200),
            point("2023-01-04", 10_500, 10_300));
    double portfolioSortino = calculator.computeSortinoRatio(curve, false);
    double spySortino = calculator.computeSortinoRatio(curve, true);
    // spy has no down days in this series → spySortino = 0; portfolio has a down day → non-zero
    assertThat(spySortino).isEqualTo(0.0);
    assertThat(portfolioSortino).isNotEqualTo(0.0);
  }

  // ── computeCalmarRatio ───────────────────────────────────────────────────────

  @Test
  @DisplayName("calmar: returns 0 when maxDrawdown is zero (avoid division by zero)")
  void calmarReturnsZeroWhenMaxDrawdownIsZero() {
    assertThat(calculator.computeCalmarRatio(15.0, 0.0)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("calmar: returns correct ratio")
  void calmarReturnsCorrectRatio() {
    // 12% CAGR / 8% max drawdown = 1.5
    assertThat(calculator.computeCalmarRatio(12.0, 8.0)).isCloseTo(1.5, within(0.0001));
  }

  @Test
  @DisplayName("calmar: negative return yields negative ratio")
  void calmarNegativeReturnYieldsNegativeRatio() {
    assertThat(calculator.computeCalmarRatio(-5.0, 20.0)).isCloseTo(-0.25, within(0.0001));
  }

  // ── equal-weight benchmark ───────────────────────────────────────────────────

  @Test
  @DisplayName("computeStatistics derives equal-weight benchmark metrics from its own curve")
  void computeStatisticsPopulatesEqualWeightMetrics() {
    var request = request();
    // Strategy ends +20%; equal-weight rises 10000 → 11000 (+10%) with a dip to 9500 (5% drawdown).
    List<EquityCurvePoint> strategy =
        List.of(
            point("2020-01-02", 10_000, 10_000),
            point("2020-06-01", 10_500, 10_200),
            point("2020-12-31", 12_000, 11_000));
    List<EquityCurvePoint> equalWeight =
        List.of(
            point("2020-01-02", 10_000, 10_000),
            point("2020-06-01", 9_500, 10_200),
            point("2020-12-31", 11_000, 11_000));

    BacktestResult result =
        calculator.computeStatistics(request, strategy, equalWeight, List.of(), 252);

    assertThat(result.equalWeightTotalReturnPct().doubleValue()).isCloseTo(10.0, within(1e-6));
    assertThat(result.equalWeightMaxDrawdownPct().doubleValue()).isCloseTo(5.0, within(1e-6));
    assertThat(result.equalWeightSharpeRatio()).isNotNull();
    // Kept distinct from the strategy's own +20% total return.
    assertThat(result.totalReturnPct().doubleValue()).isCloseTo(20.0, within(1e-6));
  }

  @Test
  @DisplayName("computeStatistics leaves equal-weight metrics null when its curve is empty")
  void computeStatisticsHandlesEmptyEqualWeightCurve() {
    List<EquityCurvePoint> strategy =
        List.of(point("2020-01-02", 10_000, 10_000), point("2020-12-31", 11_000, 11_000));

    BacktestResult result =
        calculator.computeStatistics(request(), strategy, List.of(), List.of(), 252);

    assertThat(result.equalWeightTotalReturnPct()).isNull();
    assertThat(result.equalWeightSharpeRatio()).isNull();
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private BacktestRequest request() {
    return new BacktestRequest(
        LocalDate.parse("2020-01-01"), LocalDate.parse("2020-12-31"), "MONTHLY", 5, null, "ALL", 0);
  }

  private EquityCurvePoint point(String date, double portfolio, double spy) {
    return new EquityCurvePoint(LocalDate.parse(date), portfolio, spy);
  }
}

package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.mock;

import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import com.ftm.app.signals.repository.SignalRepository;
import java.time.LocalDate;
import java.util.List;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BacktestEngineTest {

  BacktestEngine engine;

  @BeforeEach
  void setUp() {
    engine = new BacktestEngine(mock(SignalRepository.class), mock(DSLContext.class));
  }

  // ── computeSortinoRatio ──────────────────────────────────────────────────────

  @Test
  @DisplayName("sortino: returns 0 for empty curve")
  void sortinoReturnsZeroForEmptyCurve() {
    assertThat(engine.computeSortinoRatio(List.of(), false)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: returns 0 for single-point curve")
  void sortinoReturnsZeroForSinglePoint() {
    var curve = List.of(point("2023-01-01", 10_000, 10_000));
    assertThat(engine.computeSortinoRatio(curve, false)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: returns 0 when there are no negative returns (pure uptrend)")
  void sortinoReturnsZeroWhenNoNegativeReturns() {
    // monotonically increasing — downside deviation = 0 → ratio undefined → return 0
    var curve = List.of(
        point("2023-01-01", 10_000, 9_000),
        point("2023-01-02", 10_100, 9_100),
        point("2023-01-03", 10_200, 9_200));
    assertThat(engine.computeSortinoRatio(curve, false)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: positive for strategy with mean positive return and some downside days")
  void sortinoIsPositiveForPositiveMeanReturn() {
    // Portfolio goes up 2% then down 1% then up 2%: mean > 0, downside > 0 → sortino > 0
    var curve = List.of(
        point("2023-01-01", 10_000, 10_000),
        point("2023-01-02", 10_200, 10_200),
        point("2023-01-03", 10_098, 10_098),
        point("2023-01-04", 10_300, 10_300));
    assertThat(engine.computeSortinoRatio(curve, false)).isGreaterThan(0.0);
  }

  @Test
  @DisplayName("sortino: negative for strategy with mean negative return")
  void sortinoIsNegativeForNegativeMeanReturn() {
    var curve = List.of(
        point("2023-01-01", 10_000, 10_000),
        point("2023-01-02",  9_800,  9_800),
        point("2023-01-03",  9_600,  9_600));
    assertThat(engine.computeSortinoRatio(curve, false)).isLessThan(0.0);
  }

  @Test
  @DisplayName("sortino: spy mode uses spyValue column, not portfolioValue")
  void sortinoSpyModeUsesSpyValues() {
    // portfolio flat, spy moves up → spy sortino should be 0 (no downside days)
    var curve = List.of(
        point("2023-01-01", 10_000, 10_000),
        point("2023-01-02", 10_000, 10_200),
        point("2023-01-03", 10_000, 10_400));
    assertThat(engine.computeSortinoRatio(curve, true)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("sortino: portfolio and spy sortinos differ when paths diverge")
  void sortinoPortfolioAndSpyDifferWhenPathsDiverge() {
    // portfolio volatile (up/down/up), spy smooth uptrend
    var curve = List.of(
        point("2023-01-01", 10_000, 10_000),
        point("2023-01-02", 10_300, 10_100),
        point("2023-01-03",  9_900, 10_200),
        point("2023-01-04", 10_500, 10_300));
    double portSortino = engine.computeSortinoRatio(curve, false);
    double spySortino  = engine.computeSortinoRatio(curve, true);
    // spy has no down days in this series → spySortino = 0; portfolio has a down day → portSortino != 0
    assertThat(spySortino).isEqualTo(0.0);
    assertThat(portSortino).isNotEqualTo(0.0);
  }

  // ── computeCalmarRatio ───────────────────────────────────────────────────────

  @Test
  @DisplayName("calmar: returns 0 when maxDrawdown is zero (avoid division by zero)")
  void calmarReturnsZeroWhenMaxDrawdownIsZero() {
    assertThat(engine.computeCalmarRatio(15.0, 0.0)).isEqualTo(0.0);
  }

  @Test
  @DisplayName("calmar: returns correct ratio")
  void calmarReturnsCorrectRatio() {
    // 12% CAGR / 8% max drawdown = 1.5
    assertThat(engine.computeCalmarRatio(12.0, 8.0)).isCloseTo(1.5, within(0.0001));
  }

  @Test
  @DisplayName("calmar: negative return yields negative ratio")
  void calmarNegativeReturnYieldsNegativeRatio() {
    assertThat(engine.computeCalmarRatio(-5.0, 20.0)).isCloseTo(-0.25, within(0.0001));
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private EquityCurvePoint point(String date, double portfolio, double spy) {
    return new EquityCurvePoint(LocalDate.parse(date), portfolio, spy);
  }
}

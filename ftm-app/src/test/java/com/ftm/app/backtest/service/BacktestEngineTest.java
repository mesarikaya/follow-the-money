package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.Mockito.mock;

import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.jooq.DSLContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BacktestEngineTest {

  BacktestEngine engine;

  @BeforeEach
  void setUp() {
    engine = new BacktestEngine(mock(SignalRepository.class), mock(DSLContext.class), new AllocationComputer());
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
    var curve =
        List.of(
            point("2023-01-01", 10_000, 9_000),
            point("2023-01-02", 10_100, 9_100),
            point("2023-01-03", 10_200, 9_200));
    assertThat(engine.computeSortinoRatio(curve, false)).isEqualTo(0.0);
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
    assertThat(engine.computeSortinoRatio(curve, false)).isGreaterThan(0.0);
  }

  @Test
  @DisplayName("sortino: negative for strategy with mean negative return")
  void sortinoIsNegativeForNegativeMeanReturn() {
    var curve =
        List.of(
            point("2023-01-01", 10_000, 10_000),
            point("2023-01-02", 9_800, 9_800),
            point("2023-01-03", 9_600, 9_600));
    assertThat(engine.computeSortinoRatio(curve, false)).isLessThan(0.0);
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
    assertThat(engine.computeSortinoRatio(curve, true)).isEqualTo(0.0);
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
    double portSortino = engine.computeSortinoRatio(curve, false);
    double spySortino = engine.computeSortinoRatio(curve, true);
    // spy has no down days in this series → spySortino = 0; portfolio has a down day → portSortino
    // != 0
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

  // ── simulatePortfolio ────────────────────────────────────────────────────────

  @Test
  @DisplayName("simulate: empty trading dates yields empty curve")
  void simulateEmptyDatesYieldsEmptyCurve() {
    List<EquityCurvePoint> curve = engine.simulatePortfolio(List.of(), Map.of(), Map.of(), Map.of());
    assertThat(curve).isEmpty();
  }

  @Test
  @DisplayName("simulate: no allocations — portfolio stays flat at initial value")
  void simulateNoAllocationsKeepsPortfolioFlat() {
    var dates = dates("2023-01-01", "2023-01-02", "2023-01-03");
    var prices = Map.of(
        date("2023-01-01"), Map.of("TECH", bd(100)),
        date("2023-01-02"), Map.of("TECH", bd(110)),
        date("2023-01-03"), Map.of("TECH", bd(120)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, Map.of(), prices, Map.of());

    assertThat(curve).hasSize(3);
    curve.forEach(p -> assertThat(p.portfolioValue()).isCloseTo(10_000.0, within(0.01)));
  }

  @Test
  @DisplayName("simulate: flat prices yield 0% return across the period")
  void simulateFlatPricesYieldZeroReturn() {
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH"));
    var prices = Map.of(
        date("2023-01-02"), Map.of("TECH", bd(100)),
        date("2023-01-03"), Map.of("TECH", bd(100)),
        date("2023-01-04"), Map.of("TECH", bd(100)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, allocations, prices, Map.of());

    assertThat(curve).hasSize(3);
    curve.forEach(p -> assertThat(p.portfolioValue()).isCloseTo(10_000.0, within(0.01)));
  }

  @Test
  @DisplayName("simulate: 10% price gain over 2 days yields 10% portfolio return")
  void simulatePriceGainYieldsCorrectReturn() {
    var dates = dates("2023-01-02", "2023-01-03");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH"));
    var prices = Map.of(
        date("2023-01-02"), Map.of("TECH", bd(100)),
        date("2023-01-03"), Map.of("TECH", bd(110)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, allocations, prices, Map.of());

    assertThat(curve).hasSize(2);
    assertThat(curve.get(0).portfolioValue()).isCloseTo(10_000.0, within(0.01));
    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: portfolio value chains correctly across rebalance boundary")
  void simulatePortfolioValueChainsAcrossRebalance() {
    // Day 1-2: hold TECH (+10% gain → 11000), Day 3: rebalance to FINL, Day 4: FINL +10%
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05");
    var allocations = Map.of(
        date("2023-01-02"), List.of("TECH"),
        date("2023-01-04"), List.of("FINL"));
    var prices = Map.of(
        date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(200)),
        date("2023-01-03"), Map.of("TECH", bd(110), "FINL", bd(200)),
        date("2023-01-04"), Map.of("TECH", bd(110), "FINL", bd(200)),
        date("2023-01-05"), Map.of("TECH", bd(110), "FINL", bd(220)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, allocations, prices, Map.of());

    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
    // Rebalance day: value from previous period locked in
    assertThat(curve.get(2).portfolioValue()).isCloseTo(11_000.0, within(0.01));
    // FINL goes +10% from entry: 11000 * 1.1 = 12100
    assertThat(curve.get(3).portfolioValue()).isCloseTo(12_100.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: zero price at entry is excluded from allocation (not added to entryPrices)")
  void simulateZeroPriceAtEntryExcludesPositionFromAllocation() {
    // FINL has adj_close=0 at rebalance date — should be silently excluded
    var dates = dates("2023-01-02", "2023-01-03");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH", "FINL"));
    var prices = Map.of(
        date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(0)),
        date("2023-01-03"), Map.of("TECH", bd(110), "FINL", bd(0)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, allocations, prices, Map.of());

    // TECH goes +10%, FINL excluded → same as single-position 10% gain
    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: zero current price for a held position is excluded on that day")
  void simulateZeroCurrentPriceExcludesPositionOnThatDay() {
    // TECH has valid entry on D1 but adj_close=0 on D2 — must not collapse portfolio to 0
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH", "FINL"));
    var prices = Map.of(
        date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(200)),
        date("2023-01-03"), Map.of("TECH", bd(0), "FINL", bd(220)),
        date("2023-01-04"), Map.of("TECH", bd(110), "FINL", bd(220)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, allocations, prices, Map.of());

    // D3: only FINL valid (200→220 = +10%), portfolio should NOT be zeroed
    assertThat(curve.get(1).portfolioValue()).isGreaterThan(0);
    // D4: both valid, both up from entry
    assertThat(curve.get(2).portfolioValue()).isGreaterThan(10_000.0);
  }

  @Test
  @DisplayName("simulate: SPY tracking follows entry-normalized price ratio")
  void simulateSpyTracksFromEntryNormalized() {
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04");
    var spy = Map.of(
        date("2023-01-02"), bd(400),
        date("2023-01-03"), bd(440),
        date("2023-01-04"), bd(480));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, Map.of(), Map.of(), spy);

    // Entry price = 400; day 2 = 440 → 10% → 11000; day 3 = 480 → 20% → 12000
    assertThat(curve.get(0).spyValue()).isCloseTo(10_000.0, within(0.01));
    assertThat(curve.get(1).spyValue()).isCloseTo(11_000.0, within(0.01));
    assertThat(curve.get(2).spyValue()).isCloseTo(12_000.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: equal-weighted 2-position allocation returns mean of individual returns")
  void simulateTwoPositionAllocationReturnsMeanReturn() {
    // TECH +20%, FINL flat → mean = +10%
    var dates = dates("2023-01-02", "2023-01-03");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH", "FINL"));
    var prices = Map.of(
        date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(200)),
        date("2023-01-03"), Map.of("TECH", bd(120), "FINL", bd(200)));

    List<EquityCurvePoint> curve = engine.simulatePortfolio(dates, allocations, prices, Map.of());

    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private EquityCurvePoint point(String date, double portfolio, double spy) {
    return new EquityCurvePoint(LocalDate.parse(date), portfolio, spy);
  }

  private List<LocalDate> dates(String... ds) {
    return java.util.Arrays.stream(ds).map(LocalDate::parse).toList();
  }

  private LocalDate date(String d) {
    return LocalDate.parse(d);
  }

  private BigDecimal bd(double v) {
    return BigDecimal.valueOf(v);
  }
}

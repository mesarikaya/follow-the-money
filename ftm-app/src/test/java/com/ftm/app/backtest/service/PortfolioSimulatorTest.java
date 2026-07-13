package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class PortfolioSimulatorTest {

  PortfolioSimulator simulator;

  @BeforeEach
  void setUp() {
    simulator = new PortfolioSimulator(new TurnoverCostCalculator());
  }

  @Test
  @DisplayName("simulate: empty trading dates yields empty curve")
  void simulateEmptyDatesYieldsEmptyCurve() {
    List<EquityCurvePoint> curve = simulator.simulate(List.of(), Map.of(), Map.of(), Map.of());
    assertThat(curve).isEmpty();
  }

  @Test
  @DisplayName("simulate: no allocations — portfolio stays flat at initial value")
  void simulateNoAllocationsKeepsPortfolioFlat() {
    var dates = dates("2023-01-01", "2023-01-02", "2023-01-03");
    var prices =
        Map.of(
            date("2023-01-01"), Map.of("TECH", bd(100)),
            date("2023-01-02"), Map.of("TECH", bd(110)),
            date("2023-01-03"), Map.of("TECH", bd(120)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, Map.of(), prices, Map.of());

    assertThat(curve).hasSize(3);
    curve.forEach(p -> assertThat(p.portfolioValue()).isCloseTo(10_000.0, within(0.01)));
  }

  @Test
  @DisplayName("simulate: flat prices yield 0% return across the period")
  void simulateFlatPricesYieldZeroReturn() {
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH"));
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100)),
            date("2023-01-03"), Map.of("TECH", bd(100)),
            date("2023-01-04"), Map.of("TECH", bd(100)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, allocations, prices, Map.of());

    assertThat(curve).hasSize(3);
    curve.forEach(p -> assertThat(p.portfolioValue()).isCloseTo(10_000.0, within(0.01)));
  }

  @Test
  @DisplayName("simulate: 10% price gain over 2 days yields 10% portfolio return")
  void simulatePriceGainYieldsCorrectReturn() {
    var dates = dates("2023-01-02", "2023-01-03");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH"));
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100)),
            date("2023-01-03"), Map.of("TECH", bd(110)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, allocations, prices, Map.of());

    assertThat(curve).hasSize(2);
    assertThat(curve.get(0).portfolioValue()).isCloseTo(10_000.0, within(0.01));
    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: portfolio value chains correctly across rebalance boundary")
  void simulatePortfolioValueChainsAcrossRebalance() {
    // Day 1-2: hold TECH (+10% gain → 11000), Day 3: rebalance to FINL, Day 4: FINL +10%
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05");
    var allocations =
        Map.of(
            date("2023-01-02"), List.of("TECH"),
            date("2023-01-04"), List.of("FINL"));
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(200)),
            date("2023-01-03"), Map.of("TECH", bd(110), "FINL", bd(200)),
            date("2023-01-04"), Map.of("TECH", bd(110), "FINL", bd(200)),
            date("2023-01-05"), Map.of("TECH", bd(110), "FINL", bd(220)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, allocations, prices, Map.of());

    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
    // Rebalance day: value from previous period locked in
    assertThat(curve.get(2).portfolioValue()).isCloseTo(11_000.0, within(0.01));
    // FINL goes +10% from entry: 11000 * 1.1 = 12100
    assertThat(curve.get(3).portfolioValue()).isCloseTo(12_100.0, within(0.01));
  }

  @Test
  @DisplayName(
      "simulate: zero price at entry is excluded from allocation (not added to entryPrices)")
  void simulateZeroPriceAtEntryExcludesPositionFromAllocation() {
    // FINL has adj_close=0 at rebalance date — should be silently excluded
    var dates = dates("2023-01-02", "2023-01-03");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH", "FINL"));
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(0)),
            date("2023-01-03"), Map.of("TECH", bd(110), "FINL", bd(0)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, allocations, prices, Map.of());

    // TECH goes +10%, FINL excluded → same as single-position 10% gain
    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: zero current price for a held position is excluded on that day")
  void simulateZeroCurrentPriceExcludesPositionOnThatDay() {
    // TECH has valid entry on D1 but adj_close=0 on D2 — must not collapse portfolio to 0
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH", "FINL"));
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(200)),
            date("2023-01-03"), Map.of("TECH", bd(0), "FINL", bd(220)),
            date("2023-01-04"), Map.of("TECH", bd(110), "FINL", bd(220)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, allocations, prices, Map.of());

    // D3: only FINL valid (200→220 = +10%), portfolio should NOT be zeroed
    assertThat(curve.get(1).portfolioValue()).isGreaterThan(0);
    // D4: both valid, both up from entry
    assertThat(curve.get(2).portfolioValue()).isGreaterThan(10_000.0);
  }

  @Test
  @DisplayName("simulate: SPY tracking follows entry-normalized price ratio")
  void simulateSpyTracksFromEntryNormalized() {
    var dates = dates("2023-01-02", "2023-01-03", "2023-01-04");
    var spy =
        Map.of(
            date("2023-01-02"), bd(400),
            date("2023-01-03"), bd(440),
            date("2023-01-04"), bd(480));

    List<EquityCurvePoint> curve = simulator.simulate(dates, Map.of(), Map.of(), spy);

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
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100), "FINL", bd(200)),
            date("2023-01-03"), Map.of("TECH", bd(120), "FINL", bd(200)));

    List<EquityCurvePoint> curve = simulator.simulate(dates, allocations, prices, Map.of());

    assertThat(curve.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));
  }

  @Test
  @DisplayName("simulate: transaction cost drags the return below the frictionless result")
  void simulateTransactionCostReducesReturn() {
    var dates = dates("2023-01-02", "2023-01-03");
    var allocations = Map.of(date("2023-01-02"), List.of("TECH"));
    var prices =
        Map.of(
            date("2023-01-02"), Map.of("TECH", bd(100)),
            date("2023-01-03"), Map.of("TECH", bd(110)));

    // Frictionless: enter cash→TECH, +10% → 11000.
    List<EquityCurvePoint> free = simulator.simulate(dates, allocations, prices, Map.of(), 0);
    assertThat(free.get(1).portfolioValue()).isCloseTo(11_000.0, within(0.01));

    // 100 bps on the initial full-turnover entry: 10000*(1-0.01)=9900, then +10% → 10890.
    List<EquityCurvePoint> withCost = simulator.simulate(dates, allocations, prices, Map.of(), 100);
    assertThat(withCost.get(1).portfolioValue()).isCloseTo(10_890.0, within(0.01));
    assertThat(withCost.get(1).portfolioValue()).isLessThan(free.get(1).portfolioValue());
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private List<LocalDate> dates(String... values) {
    return java.util.Arrays.stream(values).map(LocalDate::parse).toList();
  }

  private LocalDate date(String value) {
    return LocalDate.parse(value);
  }

  private BigDecimal bd(double value) {
    return BigDecimal.valueOf(value);
  }
}

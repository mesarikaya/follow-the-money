package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class TurnoverCostCalculatorTest {

  private final TurnoverCostCalculator calc = new TurnoverCostCalculator();

  @Test
  @DisplayName("entering from cash is full turnover")
  void entryFromCashIsFullTurnover() {
    assertThat(calc.turnoverFraction(List.of(), List.of("A", "B", "C", "D")))
        .isCloseTo(1.0, within(1e-9));
  }

  @Test
  @DisplayName("unchanged allocation has zero turnover")
  void unchangedAllocationZeroTurnover() {
    var alloc = List.of("A", "B", "C");
    assertThat(calc.turnoverFraction(alloc, alloc)).isCloseTo(0.0, within(1e-9));
  }

  @Test
  @DisplayName("replacing one of five equal-weighted names is 1/5 turnover")
  void replacingOneOfFive() {
    var prev = List.of("A", "B", "C", "D", "E");
    var curr = List.of("A", "B", "C", "D", "F");
    assertThat(calc.turnoverFraction(prev, curr)).isCloseTo(0.2, within(1e-9));
  }

  @Test
  @DisplayName("fully swapping the portfolio is full turnover")
  void fullSwapIsFullTurnover() {
    assertThat(calc.turnoverFraction(List.of("A", "B"), List.of("C", "D")))
        .isCloseTo(1.0, within(1e-9));
  }

  @Test
  @DisplayName("cost fraction scales turnover by basis points")
  void costFractionScalesByBps() {
    // full turnover at 25 bps -> 0.25% cost
    assertThat(calc.costFraction(List.of(), List.of("A", "B"), 25))
        .isCloseTo(0.0025, within(1e-9));
    // 1/5 turnover at 50 bps -> 0.2 * 0.005 = 0.001
    assertThat(
            calc.costFraction(
                List.of("A", "B", "C", "D", "E"), List.of("A", "B", "C", "D", "F"), 50))
        .isCloseTo(0.001, within(1e-9));
  }

  @Test
  @DisplayName("zero or negative bps yields no cost")
  void zeroBpsNoCost() {
    assertThat(calc.costFraction(List.of(), List.of("A"), 0)).isZero();
    assertThat(calc.costFraction(List.of(), List.of("A"), -10)).isZero();
  }
}

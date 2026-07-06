package com.ftm.app.api.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BacktestRequestTest {

  /**
   * Regression guard for the #97 deserialization break: the invertSignal/trendFilter flags must be
   * {@code Boolean} (not primitive) so an omitted JSON field (which Jackson maps to {@code null})
   * deserializes and defaults to {@code false}, rather than failing null-to-primitive mapping and
   * 500-ing every backtest that doesn't send the flag. Passing {@code null} below only compiles if
   * the fields are Boolean.
   */
  @Test
  @DisplayName("null invertSignal/trendFilter default to false")
  void nullFlagsDefaultToFalse() {
    BacktestRequest request =
        new BacktestRequest(
            LocalDate.of(2019, 5, 16),
            LocalDate.of(2024, 12, 31),
            "MONTHLY",
            5,
            null,
            "ALL",
            10,
            null,
            null,
            null);

    assertThat(request.invertSignal()).isFalse();
    assertThat(request.trendFilter()).isFalse();
  }

  @Test
  @DisplayName("null/blank signalSource defaults to COMPOSITE")
  void nullSignalSourceDefaultsToComposite() {
    BacktestRequest defaulted =
        new BacktestRequest(
            LocalDate.of(2019, 5, 16), LocalDate.of(2024, 12, 31), "MONTHLY", 5, null, null, null);
    assertThat(defaulted.signalSource()).isEqualTo("COMPOSITE");

    BacktestRequest blank =
        new BacktestRequest(
            LocalDate.of(2019, 5, 16),
            LocalDate.of(2024, 12, 31),
            "MONTHLY",
            5,
            null,
            "ALL",
            0,
            null,
            null,
            "  ");
    assertThat(blank.signalSource()).isEqualTo("COMPOSITE");
  }

  @Test
  @DisplayName("compact constructor defaults topN, categoryScope and transactionCostBps")
  void compactConstructorDefaults() {
    BacktestRequest request =
        new BacktestRequest(
            LocalDate.of(2019, 5, 16), LocalDate.of(2024, 12, 31), "MONTHLY", 0, null, null, null);

    assertThat(request.topN()).isEqualTo(5);
    assertThat(request.categoryScope()).isEqualTo("ALL");
    assertThat(request.transactionCostBps()).isZero();
    assertThat(request.invertSignal()).isFalse();
    assertThat(request.trendFilter()).isFalse();
  }
}

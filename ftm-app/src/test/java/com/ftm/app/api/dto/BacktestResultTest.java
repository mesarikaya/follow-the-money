package com.ftm.app.api.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BacktestResultTest {

  private BacktestResult sampleWithConfig() {
    return new BacktestResult(
        UUID.randomUUID(),
        OffsetDateTime.now(),
        LocalDate.of(2020, 1, 1),
        LocalDate.of(2024, 12, 31),
        "MONTHLY",
        3,
        new BigDecimal("0.60"),
        "MOMENTUM_12_1",
        "EQUITY_SECTOR",
        true,
        true,
        25,
        new BigDecimal("42.0"),
        new BigDecimal("8.0"),
        new BigDecimal("30.0"),
        new BigDecimal("0.5"),
        new BigDecimal("0.6"),
        new BigDecimal("0.4"),
        new BigDecimal("100.0"),
        new BigDecimal("15.0"),
        new BigDecimal("33.0"),
        new BigDecimal("0.8"),
        new BigDecimal("0.9"),
        new BigDecimal("0.7"),
        new BigDecimal("90.0"),
        new BigDecimal("14.0"),
        new BigDecimal("32.0"),
        new BigDecimal("0.75"),
        1000,
        List.of(new BacktestResult.EquityCurvePoint(LocalDate.of(2020, 1, 2), 10000.0, 10000.0)),
        List.of(new BacktestResult.RebalanceEvent(LocalDate.of(2020, 1, 2), List.of("TECH"), 10000.0)));
  }

  @Test
  void strippedPreservesRunConfigSoSweepResultsStayDistinguishable() {
    BacktestResult stripped = sampleWithConfig().stripped();

    // The sweep endpoints return stripped() results that differ only by topN/frequency; the signal
    // source and scope must survive or the whole comparison becomes ambiguous.
    assertThat(stripped.signalSource()).isEqualTo("MOMENTUM_12_1");
    assertThat(stripped.categoryScope()).isEqualTo("EQUITY_SECTOR");
    assertThat(stripped.invertSignal()).isTrue();
    assertThat(stripped.trendFilter()).isTrue();
    assertThat(stripped.transactionCostBps()).isEqualTo(25);
    assertThat(stripped.rebalanceFrequency()).isEqualTo("MONTHLY");
    assertThat(stripped.topN()).isEqualTo(3);
    assertThat(stripped.signalThreshold()).isEqualByComparingTo("0.60");
  }

  @Test
  void strippedDropsIdentityAndHeavyPayload() {
    BacktestResult stripped = sampleWithConfig().stripped();

    // Sweeps don't persist, so identity and the per-day curves are cleared to keep payloads light.
    assertThat(stripped.runId()).isNull();
    assertThat(stripped.runAt()).isNull();
    assertThat(stripped.equityCurve()).isEmpty();
    assertThat(stripped.rebalanceHistory()).isEmpty();

    // Headline metrics are retained so each swept run is still comparable.
    assertThat(stripped.totalReturnPct()).isEqualByComparingTo("42.0");
    assertThat(stripped.sharpeRatio()).isEqualByComparingTo("0.5");
    assertThat(stripped.spyTotalReturnPct()).isEqualByComparingTo("100.0");
  }
}

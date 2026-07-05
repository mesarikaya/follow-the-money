package com.ftm.app.api.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record BacktestRequest(
    @NotNull LocalDate startDate,
    @NotNull LocalDate endDate,
    @NotNull String rebalanceFrequency,
    @Min(1) @Max(19) int topN,
    BigDecimal signalThreshold,
    String categoryScope,
    @Min(0) @Max(500) Integer transactionCostBps,
    boolean invertSignal) {
  public BacktestRequest {
    if (topN == 0) topN = 5;
    if (categoryScope == null || categoryScope.isBlank()) categoryScope = "ALL";
    if (transactionCostBps == null) transactionCostBps = 0;
  }

  /** Convenience constructor defaulting to the momentum (non-inverted) signal. */
  public BacktestRequest(
      LocalDate startDate,
      LocalDate endDate,
      String rebalanceFrequency,
      int topN,
      BigDecimal signalThreshold,
      String categoryScope,
      Integer transactionCostBps) {
    this(
        startDate,
        endDate,
        rebalanceFrequency,
        topN,
        signalThreshold,
        categoryScope,
        transactionCostBps,
        false);
  }
}

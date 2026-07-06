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
    Boolean invertSignal,
    Boolean trendFilter,
    String signalSource) {
  public BacktestRequest {
    if (topN == 0) topN = 5;
    if (categoryScope == null || categoryScope.isBlank()) categoryScope = "ALL";
    if (transactionCostBps == null) transactionCostBps = 0;
    // Boolean (not primitive) so an omitted JSON field deserializes as null → defaulted here,
    // rather than failing Jackson's null-to-primitive mapping.
    if (invertSignal == null) invertSignal = false;
    if (trendFilter == null) trendFilter = false;
    // Which score drives selection: "COMPOSITE" (the theory model) or "MOMENTUM_12_1" (classic
    // 12-1 momentum). Defaulted so an omitted field keeps the existing composite behaviour.
    if (signalSource == null || signalSource.isBlank()) signalSource = "COMPOSITE";
  }

  /** Convenience constructor defaulting to the composite signal, non-inverted, no trend filter. */
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
        false,
        false,
        "COMPOSITE");
  }
}

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
        BigDecimal signalThreshold
) {
    public BacktestRequest {
        if (topN == 0) topN = 5;
    }
}

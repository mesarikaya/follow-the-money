package com.ftm.app.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record BacktestResult(
        UUID runId,
        OffsetDateTime runAt,
        LocalDate startDate,
        LocalDate endDate,
        String rebalanceFrequency,
        int topN,
        BigDecimal signalThreshold,
        BigDecimal totalReturnPct,
        BigDecimal annualizedReturnPct,
        BigDecimal maxDrawdownPct,
        BigDecimal sharpeRatio,
        BigDecimal spyTotalReturnPct,
        BigDecimal spySharpeRatio,
        int tradingDays,
        List<EquityCurvePoint> equityCurve
) {
    public record EquityCurvePoint(LocalDate date, double portfolioValue, double spyValue) {}
}

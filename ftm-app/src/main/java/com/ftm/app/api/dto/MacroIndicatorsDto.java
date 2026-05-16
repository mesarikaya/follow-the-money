package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Latest macro indicator values from FRED")
public record MacroIndicatorsDto(
        @Schema(description = "10Y-2Y Treasury yield spread (T10Y2Y)") BigDecimal yieldSpread10y2y,
        @Schema(description = "CBOE Volatility Index (VIXCLS)") BigDecimal vix,
        @Schema(description = "USD trade-weighted index (DTWEXBGS)") BigDecimal usdIndex,
        @Schema(description = "10Y breakeven inflation rate (T10YIE)") BigDecimal breakevenInflation,
        @Schema(description = "Effective federal funds rate (FEDFUNDS)") BigDecimal fedFundsRate,
        @Schema(description = "10-year Treasury yield (DGS10)") BigDecimal tenYearYield,
        @Schema(description = "2-year Treasury yield (DGS2)") BigDecimal twoYearYield
) {}

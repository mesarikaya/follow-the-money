package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "Category summary with latest signals")
public record CategorySummaryDto(
        @Schema(description = "Category identifier", example = "TECH") String id,
        @Schema(description = "Category display name") String name,
        @Schema(description = "Category type", example = "EQUITY_SECTOR") String type,
        @Schema(description = "ETF ticker symbol", example = "XLK") String etfTicker,
        @Schema(description = "Composite rotation score 0–1; null until signals computed") BigDecimal compositeScore,
        @Schema(description = "20-day composite trend; null until signals computed") BigDecimal compositeTrend20d,
        @Schema(description = "RRG quadrant; null until signals computed") String rrgQuadrant,
        @Schema(description = "60-day relative strength vs benchmark; null until signals computed") BigDecimal rs60,
        @Schema(description = "20-day flow z-score; null until signals computed") BigDecimal flow20d,
        @Schema(description = "Count of positive-flow days in last 20; null until signals computed") Integer persistence20d,
        @Schema(description = "Rank by composite score (1 = strongest)") Integer rank
) {}

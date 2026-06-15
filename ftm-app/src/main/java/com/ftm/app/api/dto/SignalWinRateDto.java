package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "Historical BUY signal win rate for a category")
public record SignalWinRateDto(
    @Schema(description = "Category identifier") String categoryId,
    @Schema(description = "Number of new BUY signals fired in the lookback window") int signalCount,
    @Schema(description = "Fraction of BUY signals followed by positive 30-day return (0.0–1.0)")
        BigDecimal winRate,
    @Schema(
            description =
                "Average 30-day forward return across all BUY signals in the window (e.g. 0.045 = +4.5%)")
        BigDecimal avgReturn30d,
    @Schema(
            description =
                "Average 90-day forward return across BUY signals that have at least 90 days of"
                    + " history. Null when no signal is old enough.")
        BigDecimal avgReturn90d) {}

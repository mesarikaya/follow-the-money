package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(
    description =
        "A category approaching its next trade signal threshold based on current momentum velocity")
public record ApproachingSignalDto(
    @Schema(description = "Category identifier", example = "GOLD") String categoryId,
    @Schema(description = "Category display name") String categoryName,
    @Schema(description = "ETF ticker", example = "GLD") String etfTicker,
    @Schema(description = "Current trade signal: BUY, WATCH, HOLD, REDUCE") String currentSignal,
    @Schema(description = "Projected next signal if momentum continues") String projectedSignal,
    @Schema(
            description =
                "Estimated trading days until next threshold crossing; null if projection unreliable")
        Integer estimatedDays,
    @Schema(description = "Current composite score 0–1") BigDecimal currentScore,
    @Schema(description = "Score gap to next threshold — positive means score must rise")
        BigDecimal scoreGapToThreshold,
    @Schema(
            description =
                "Daily score velocity derived from 5-day trend (points per day); positive = rising")
        BigDecimal dailyVelocity,
    @Schema(
            description =
                "Confidence: HIGH (<= 7 days, sustained momentum), MEDIUM (8–15 days), LOW (16–30 days)")
        String confidence) {}

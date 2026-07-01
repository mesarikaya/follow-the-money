package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(
    description =
        "Recommended action for a single holding based on cross-referencing with signal engine")
public record HoldingActionDto(
    @Schema(description = "Ticker symbol", example = "ENRG") String ticker,
    @Schema(description = "Security name") String name,
    @Schema(description = "FTM category ID; null = unclassified") String categoryId,
    @Schema(description = "Category display name; null if unclassified") String categoryName,
    @Schema(description = "Current trade signal: BUY, WATCH, HOLD, REDUCE; null = unclassified")
        String signal,
    @Schema(description = "Conviction score 0–100; null if signal not available or HOLD")
        Integer convictionScore,
    @Schema(description = "Recommended action: EXIT, TRIM, WATCH, HOLD, or UNCLASSIFIED")
        String action,
    @Schema(description = "Short human-readable rationale explaining the recommendation")
        String rationale,
    @Schema(
            description =
                "Portfolio weight as a percentage of total EUR value; null if no price data")
        BigDecimal portfolioPct,
    @Schema(
            description =
                "Urgency order: lower = more urgent (EXIT=1, TRIM=2, WATCH=3, HOLD=4, UNCLASSIFIED=5)")
        int urgency) {}

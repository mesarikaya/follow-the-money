package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "High-level market snapshot derived from latest rotation signals")
public record ScreenerSnapshotDto(
    @Schema(description = "Number of categories with a BUY trade signal") int buyCount,
    @Schema(description = "Number of categories with a WATCH trade signal") int watchCount,
    @Schema(description = "Number of categories with a HOLD trade signal") int holdCount,
    @Schema(description = "Number of categories with a REDUCE trade signal") int reduceCount,
    @Schema(description = "Total number of top-level categories with signal data")
        int totalCategories,
    @Schema(
            description =
                "Average composite score across all top-level categories [0,1]; 0 when no data")
        double avgCompositeScore,
    @Schema(
            description =
                "Percentage of top-level categories with RS-60 > 0 (outperforming benchmark); 0 when no data")
        double rsBreadthPct,
    @Schema(
            description =
                "Percentage of top-level categories where RS-20 > RS-60 (short-term outpacing medium-term); 0 when no data")
        double momentumBreadthPct,
    @Schema(
            description =
                "Percentage of top-level categories in RRG Leading or Improving quadrant; 0 when no data")
        double riskOnPct) {}

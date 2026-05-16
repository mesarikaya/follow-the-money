package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

@Schema(description = "A category ranked among the top rotation leaders or laggards")
public record RotationLeaderEntry(
        @Schema(description = "Category identifier") String categoryId,
        @Schema(description = "Category display name") String categoryName,
        @Schema(description = "Composite score in [0,1]") BigDecimal compositeScore,
        @Schema(description = "RS_60 relative-strength value") BigDecimal relativeStrength60Day,
        @Schema(description = "RRG quadrant (1=Lagging, 2=Weakening, 3=Improving, 4=Leading)") Integer relativeRotationGraphQuadrant
) {}

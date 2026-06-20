package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Weighted factor contributions to the composite score for one category")
public record ScoreDecompositionDto(
    @Schema(description = "Category identifier") String categoryId,
    @Schema(description = "RS-60 contribution — null when signal unavailable")
        Double relativeStrength60Contribution,
    @Schema(description = "RS-120 contribution — null when signal unavailable")
        Double relativeStrength120Contribution,
    @Schema(description = "Persistence-20D contribution — null when signal unavailable")
        Double persistence20dContribution,
    @Schema(description = "Flow-20D contribution — null when signal unavailable")
        Double flow20dContribution,
    @Schema(description = "Momentum contribution — null when signal unavailable")
        Double momentumContribution,
    @Schema(description = "MacroFit contribution — null when signal unavailable")
        Double macroFitContribution,
    @Schema(description = "RRG contribution — null when signal unavailable") Double rrgContribution,
    @Schema(description = "Total composite score (0.0–1.0); sum of non-null contributions")
        Double totalScore) {}

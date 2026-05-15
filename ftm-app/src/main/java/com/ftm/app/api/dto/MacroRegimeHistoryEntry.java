package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;

@Schema(description = "Macro regime classification for a given date")
public record MacroRegimeHistoryEntry(
        @Schema(description = "Date of the regime classification") LocalDate date,
        @Schema(description = "Regime label", example = "RISK_ON_GROWTH") String regime
) {}

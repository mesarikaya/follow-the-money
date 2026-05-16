package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDate;
import java.util.List;

@Schema(description = "Current macro regime and indicator snapshot")
public record MacroResponse(
        @Schema(description = "Date of the latest indicator data") LocalDate asOfDate,
        @Schema(description = "Current macro regime classification", example = "RISK_ON_GROWTH") String regime,
        MacroIndicatorsDto indicators,
        List<MacroRegimeHistoryEntry> regimeHistory
) {}

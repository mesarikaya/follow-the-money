package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Schema(description = "Current macro regime and indicator snapshot")
public record MacroResponse(
    @Schema(description = "Date of the latest indicator data") LocalDate asOfDate,
    @Schema(description = "Current macro regime classification", example = "RISK_ON_GROWTH")
        String regime,
    MacroIndicatorsDto indicators,
    MacroIndicatorsDto previousIndicators,
    List<MacroRegimeHistoryEntry> regimeHistory,
    @Schema(
            description =
                "MACRO_FIT win rate per category — fraction of days in current regime where RS_60 > 0")
        Map<String, BigDecimal> macroFitByCategory) {}

package com.ftm.app.api.dto;

import com.ftm.app.domain.SignalType;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

@Schema(description = "Single signal observation")
public record SignalHistoryDto(
        @Schema(description = "Signal computation date") LocalDate signalDate,
        @Schema(description = "Signal type") SignalType signalType,
        @Schema(description = "Computed value") BigDecimal value,
        @Schema(description = "When this value was computed") OffsetDateTime computedAt
) {}

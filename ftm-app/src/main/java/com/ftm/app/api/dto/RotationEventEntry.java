package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "A detected rotation event")
public record RotationEventEntry(
    @Schema(description = "Date the event was detected") LocalDate detectedDate,
    @Schema(description = "Category identifier") String categoryId,
    @Schema(description = "Category display name") String categoryName,
    @Schema(description = "Event type") String eventType,
    @Schema(description = "Confidence score in [0,1]") BigDecimal confidence,
    @Schema(description = "Notes describing the event") String notes) {}

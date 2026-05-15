package com.ftm.app.domain;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RotationEvent(
        Long id,
        LocalDate detectedDate,
        CategoryId categoryId,
        RotationEventType eventType,
        @DecimalMin("0.000") @DecimalMax("1.000") BigDecimal confidence,
        String signalSnapshot,
        String notes
) {
    public RotationEvent(LocalDate detectedDate, CategoryId categoryId, RotationEventType eventType,
                         BigDecimal confidence, String signalSnapshot, String notes) {
        this(null, detectedDate, categoryId, eventType, confidence, signalSnapshot, notes);
    }
}

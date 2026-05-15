package com.ftm.app.domain;

import java.time.OffsetDateTime;

public record Alert(
        Long id,
        OffsetDateTime createdAt,
        CategoryId categoryId,
        String ruleId,
        Severity severity,
        String message,
        String triggerSnapshot,
        AlertStatus status,
        OffsetDateTime resolvedAt,
        OffsetDateTime acknowledgedAt
) {
    public Alert(OffsetDateTime createdAt, CategoryId categoryId, String ruleId, Severity severity,
                 String message, String triggerSnapshot, AlertStatus status) {
        this(null, createdAt, categoryId, ruleId, severity, message, triggerSnapshot, status, null, null);
    }
}

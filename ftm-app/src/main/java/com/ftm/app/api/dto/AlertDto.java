package com.ftm.app.api.dto;

import java.time.OffsetDateTime;

public record AlertDto(
    Long id,
    OffsetDateTime createdAt,
    String categoryId,
    String themeId,
    String ruleId,
    String severity,
    String message,
    String triggerSnapshot,
    String status,
    OffsetDateTime resolvedAt,
    OffsetDateTime acknowledgedAt) {}

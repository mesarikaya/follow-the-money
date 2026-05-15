package com.ftm.app.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record AlertRule(
        String ruleId,
        Boolean enabled,
        BigDecimal zThreshold,
        Integer persistenceDays,
        BigDecimal compositeThreshold,
        Severity severity,
        String categoryFilter,
        String config,
        OffsetDateTime lastUpdated
) {}

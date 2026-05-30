package com.ftm.app.api.dto;

import java.math.BigDecimal;

public record AlertRuleDto(
    String ruleId,
    boolean enabled,
    String severity,
    BigDecimal compositeThreshold,
    Integer persistenceDays) {}

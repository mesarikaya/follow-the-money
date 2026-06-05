package com.ftm.app.api.dto;

import java.math.BigDecimal;

public record SeasonalReturnDto(
    String categoryId,
    int month,
    BigDecimal avgReturn,
    int sampleCount
) {}

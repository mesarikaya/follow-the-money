package com.ftm.app.api.dto;

import java.math.BigDecimal;

public record ThemeConstituentDto(
    String categoryId,
    String parentCategoryId,
    String name,
    String etfTicker,
    BigDecimal compositeScore,
    BigDecimal rs60,
    BigDecimal flow20d,
    BigDecimal compositeTrend20d,
    String tradeSignal,
    Integer convictionScore) {}

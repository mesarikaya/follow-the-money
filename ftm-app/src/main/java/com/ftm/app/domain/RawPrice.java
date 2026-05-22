package com.ftm.app.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RawPrice(
    LocalDate tradeDate,
    CategoryId categoryId,
    BigDecimal open,
    BigDecimal high,
    BigDecimal low,
    BigDecimal close,
    BigDecimal adjClose,
    Long volume,
    BigDecimal assetsUnderManagementUsd,
    BigDecimal estimatedFlow) {}

package com.ftm.app.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Holding(
        Long id,
        String ticker,
        String name,
        String categoryId,
        String currency,
        BigDecimal quantity,
        BigDecimal avgCostLocal,
        BigDecimal usdFxRate,
        OffsetDateTime uploadedAt
) {}

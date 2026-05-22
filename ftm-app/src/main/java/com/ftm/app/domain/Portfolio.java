package com.ftm.app.domain;

import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Portfolio(
    CategoryId categoryId,
    @DecimalMin("0.00") BigDecimal allocationPct,
    OffsetDateTime lastUpdated,
    String notes) {}

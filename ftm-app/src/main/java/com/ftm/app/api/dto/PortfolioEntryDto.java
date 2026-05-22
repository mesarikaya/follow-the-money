package com.ftm.app.api.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PortfolioEntryDto(
    @NotNull String categoryId, @NotNull @DecimalMin("0.00") BigDecimal allocationPct) {}

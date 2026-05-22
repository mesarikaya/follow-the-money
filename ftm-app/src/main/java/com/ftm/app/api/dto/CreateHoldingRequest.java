package com.ftm.app.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record CreateHoldingRequest(
    @NotBlank String ticker,
    String name,
    String categoryId,
    @NotBlank String currency,
    @NotNull @Positive BigDecimal quantity,
    BigDecimal avgCostLocal) {}

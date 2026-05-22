package com.ftm.app.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TickerMappingRequest(
    @NotBlank @Size(max = 20) String ticker,
    @NotBlank @Size(max = 10) String categoryId,
    @Size(max = 200) String notes) {}

package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

@Schema(description = "Partial update for an existing holding")
public record HoldingUpdateRequest(
        @NotNull
        @DecimalMin("0")
        @Schema(description = "New quantity of shares/units", example = "15.0") BigDecimal quantity,
        @Schema(description = "New average cost per unit in the original currency; null = keep existing", example = "190.00") BigDecimal avgCostLocal
) {}

package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;
import java.util.List;

@Schema(description = "Result of a holdings CSV upload")
public record HoldingsUploadResponse(
        @Schema(description = "Total number of holdings accepted") int totalAccepted,
        @Schema(description = "Tickers that could not be classified to a category") List<String> unclassifiedTickers,
        @Schema(description = "Total portfolio market value in USD (null if no USD conversion available)") BigDecimal totalMarketValueUsd,
        @Schema(description = "USD/EUR exchange rate used for EUR holdings; null if no EUR holdings") BigDecimal usdPerEurRateUsed,
        @Schema(description = "All accepted holdings") List<HoldingDto> holdings
) {}

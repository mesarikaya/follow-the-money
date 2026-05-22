package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "A single investment holding")
public record HoldingDto(
    @Schema(description = "Ticker symbol", example = "AAPL") String ticker,
    @Schema(description = "Security name", example = "Apple Inc.") String name,
    @Schema(description = "FTM category ID; null = unclassified", example = "TECH")
        String categoryId,
    @Schema(description = "Currency of the holding: USD or EUR", example = "USD") String currency,
    @Schema(description = "Number of shares/units held", example = "10.5") BigDecimal quantity,
    @Schema(description = "Average cost per unit in the holding's currency", example = "185.00")
        BigDecimal avgCostLocal,
    @Schema(
            description = "USD per EUR exchange rate at upload time; null if USD holding",
            example = "1.085")
        BigDecimal usdFxRate,
    @Schema(
            description =
                "Market value in USD (quantity × avgCostLocal × usdFxRate for EUR; quantity × avgCostLocal for USD); null if avgCostLocal missing")
        BigDecimal marketValueUsd,
    @Schema(
            description =
                "Latest price in the holding's local currency from Yahoo Finance; null if not yet fetched")
        BigDecimal currentPriceLocal,
    @Schema(description = "Date of the latest price observation", example = "2026-05-16")
        LocalDate priceDate,
    @Schema(description = "Source of the latest price: 'yahoo_finance' or null if not fetched")
        String priceSource,
    @Schema(
            description =
                "Market value in EUR (quantity × currentPriceLocal, converted if USD); null if no current price")
        BigDecimal marketValueEur) {}

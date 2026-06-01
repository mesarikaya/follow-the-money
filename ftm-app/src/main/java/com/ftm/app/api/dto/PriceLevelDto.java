package com.ftm.app.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

@Schema(description = "52-week price range context for a category")
public record PriceLevelDto(
    @Schema(description = "Category identifier") String categoryId,
    @Schema(description = "Latest adj_close price") BigDecimal currentPrice,
    @Schema(description = "Highest adj_close in trailing 252 trading days") BigDecimal high52w,
    @Schema(description = "Lowest adj_close in trailing 252 trading days") BigDecimal low52w,
    @Schema(
            description =
                "Drawdown from 52-week high: (currentPrice - high52w) / high52w. "
                    + "Negative = below high (e.g. -0.12 = 12% off peak).")
        BigDecimal drawdownFromHigh,
    @Schema(
            description =
                "Position within 52-week range [0.0–1.0]: "
                    + "0.0 = at 52w low, 1.0 = at 52w high.")
        BigDecimal positionInRange,
    @Schema(description = "Number of trading days of data used in the range calculation")
        int daysOfData) {}

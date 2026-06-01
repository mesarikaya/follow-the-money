package com.ftm.app.api.dto;

import com.ftm.app.domain.CategoryId;
import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;
import java.time.LocalDate;

@Schema(description = "Category summary with latest signals")
public record CategorySummaryDto(
    @Schema(description = "Category identifier", example = "TECH") CategoryId id,
    @Schema(description = "Category display name") String name,
    @Schema(description = "Category type", example = "EQUITY_SECTOR") String type,
    @Schema(description = "ETF ticker symbol", example = "XLK") String etfTicker,
    @Schema(description = "Composite rotation score 0–1; null until signals computed")
        BigDecimal compositeScore,
    @Schema(description = "5-day composite trend; null until signals computed")
        BigDecimal compositeTrend5d,
    @Schema(description = "10-day composite trend; null until signals computed")
        BigDecimal compositeTrend10d,
    @Schema(description = "20-day composite trend; null until signals computed")
        BigDecimal compositeTrend20d,
    @Schema(description = "RRG quadrant; null until signals computed") String rrgQuadrant,
    @Schema(description = "60-day relative strength vs benchmark; null until signals computed")
        BigDecimal rs60,
    @Schema(description = "120-day relative strength vs benchmark; null until signals computed")
        BigDecimal rs120,
    @Schema(description = "20-day flow z-score; null until signals computed") BigDecimal flow20d,
    @Schema(description = "Count of positive-flow days in last 5; null until signals computed")
        Integer persistence5d,
    @Schema(description = "Count of positive-flow days in last 20; null until signals computed")
        Integer persistence20d,
    @Schema(description = "Rank by composite score (1 = strongest)") Integer rank,
    @Schema(description = "Latest ETF closing price; null if not yet ingested")
        BigDecimal latestClose,
    @Schema(description = "Date of the latest closing price; null if not yet ingested")
        LocalDate priceDate,
    @Schema(description = "Trade signal: BUY, WATCH, HOLD, or REDUCE; null until signals computed")
        String tradeSignal,
    @Schema(
            description =
                "MACRO_FIT win rate in current regime [0,1]; null for sub-sectors or until signals computed")
        BigDecimal macroFit,
    @Schema(
            description =
                "MOM — 10-day change in RS_60 ratio; positive = accelerating relative strength")
        BigDecimal momentum,
    @Schema(
            description =
                "Consecutive trading days with composite score ≥ 0.50 (any positive signal tier); null when no active signal")
        Integer signalDaysActive,
    @Schema(
            description =
                "20-day realized annualized volatility (log-return STDDEV × √252); null until price data available")
        BigDecimal realizedVol20d) {}

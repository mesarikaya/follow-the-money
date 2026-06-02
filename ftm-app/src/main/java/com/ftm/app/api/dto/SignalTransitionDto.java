package com.ftm.app.api.dto;

import java.time.LocalDate;

/**
 * A category whose derived trade signal changed between two dates.
 *
 * <p>Only transitions involving a signal change (e.g. HOLD→BUY, WATCH→REDUCE) are included. Null
 * previous signal means the category had no data on the comparison date.
 */
public record SignalTransitionDto(
    String categoryId,
    String categoryName,
    String etfTicker,
    String previousSignal,
    String currentSignal,
    double currentScore,
    LocalDate comparisonDate,
    int daysAgo,
    Double scorePercentile252d,
    Double macroFit,
    Integer signalDaysActive,
    Integer convictionScore) {}

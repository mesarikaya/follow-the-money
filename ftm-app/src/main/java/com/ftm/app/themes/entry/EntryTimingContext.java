package com.ftm.app.themes.entry;

public record EntryTimingContext(
    String themePhase,
    Double compositeScore,
    String riskLevel,
    Double volatility30d,
    Double compositeTrend5d,
    Double compositeTrend20d,
    int signalStreakDays) {}

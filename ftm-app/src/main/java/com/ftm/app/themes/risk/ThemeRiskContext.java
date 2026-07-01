package com.ftm.app.themes.risk;

public record ThemeRiskContext(
    String themePhase,
    Double compositeScore,
    Double volatility30d,
    Double compositeTrend5d,
    Double compositeTrend20d,
    int alertCount30d,
    int signalStreakDays) {}

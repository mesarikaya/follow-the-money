package com.ftm.app.themes.scoring;

public record ThemeScoreContext(
    Double compositeScore,
    int signalStreakDays,
    Double volatility30d,
    Double compositeTrend20d,
    Double flow20d) {}

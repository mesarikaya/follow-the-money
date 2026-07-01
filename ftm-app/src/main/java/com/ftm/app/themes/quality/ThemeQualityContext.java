package com.ftm.app.themes.quality;

public record ThemeQualityContext(
    int confluenceScore,
    int persistenceScore,
    int signalStreakDays,
    Double volatility30d,
    Double concentrationRisk,
    Double scorePercentile30d) {}

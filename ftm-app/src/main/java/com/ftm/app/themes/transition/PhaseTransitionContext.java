package com.ftm.app.themes.transition;

public record PhaseTransitionContext(
    String currentPhase,
    Double compositeScore,
    int signalStreakDays,
    Double compositeTrend5d,
    Double compositeTrend20d,
    Double flow20d,
    Double volatility30d,
    int alertCount30d) {}

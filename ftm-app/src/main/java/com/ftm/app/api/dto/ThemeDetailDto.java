package com.ftm.app.api.dto;

import java.util.List;

public record ThemeDetailDto(
    String id,
    String name,
    String thesis,
    int constituentCount,
    Double compositeScore,
    Double rs60,
    Double flow20d,
    Double compositeTrend5d,
    Double compositeTrend20d,
    int bullishCount,
    String dominantSignal,
    Double divergenceFromParentSectors,
    String themePhase,
    List<ThemeConstituentDto> constituents,
    int alertCount30d,
    int signalStreakDays,
    Double volatility30d,
    Double scorePercentile30d,
    Double concentrationRisk,
    String phaseTransitionSignal,
    String riskLevel,
    String entryAction,
    String entryRationale,
    String momentumAlignment) {}

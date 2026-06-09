package com.ftm.app.api.dto;

import java.util.List;

public record ThemeSummaryDto(
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
    List<ThemeConstituentDto> topConstituents) {}

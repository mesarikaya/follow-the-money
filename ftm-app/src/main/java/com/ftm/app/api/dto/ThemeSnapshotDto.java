package com.ftm.app.api.dto;

public record ThemeSnapshotDto(
    int totalThemes,
    int buyCount,
    int watchCount,
    int holdCount,
    int reduceCount,
    int breakoutCount,
    int momentumCount,
    int buildingCount,
    int fadingCount,
    int weakCount,
    double averageCompositeScore,
    int gainingMomentumCount,
    int losingMomentumCount) {}

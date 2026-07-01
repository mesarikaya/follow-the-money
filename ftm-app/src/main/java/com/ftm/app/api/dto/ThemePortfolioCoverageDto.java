package com.ftm.app.api.dto;

import java.util.List;

public record ThemePortfolioCoverageDto(
    String themeId,
    String themeName,
    String dominantSignal,
    String themePhase,
    double compositeScore,
    boolean covered,
    List<String> coveringTickers,
    double portfolioExposurePct) {}

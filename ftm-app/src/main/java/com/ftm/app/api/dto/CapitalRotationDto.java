package com.ftm.app.api.dto;

import java.util.List;

public record CapitalRotationDto(
    double rotationScore,
    String intensityLabel,
    double scoreDispersion,
    double trendAlignment,
    List<String> leadingThemeNames,
    List<String> laggingThemeNames) {}

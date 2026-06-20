package com.ftm.app.themes.rotation;

import java.util.List;

public record CapitalRotationResult(
    double rotationScore,
    String intensityLabel,
    double scoreDispersion,
    double trendAlignment,
    List<String> leadingThemeNames,
    List<String> laggingThemeNames) {}

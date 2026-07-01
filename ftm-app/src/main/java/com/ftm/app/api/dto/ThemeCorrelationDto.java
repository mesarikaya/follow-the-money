package com.ftm.app.api.dto;

import java.util.List;

public record ThemeCorrelationDto(
    List<String> themeIds,
    List<String> themeNames,
    double[][] matrix) {}

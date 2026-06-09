package com.ftm.app.api.dto;

public record ThemeHistoryPointDto(
    String date, double compositeScore, Double trend5d, Double trend20d) {}

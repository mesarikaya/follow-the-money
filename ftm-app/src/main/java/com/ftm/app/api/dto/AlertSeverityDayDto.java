package com.ftm.app.api.dto;

import java.time.LocalDate;

public record AlertSeverityDayDto(
    LocalDate date,
    int urgentCount,
    int actionCount,
    int warningCount,
    int infoCount) {}

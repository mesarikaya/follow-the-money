package com.ftm.app.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MacroSeriesPoint(LocalDate date, BigDecimal value) {}

package com.ftm.app.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record RrgTrailPoint(LocalDate date, BigDecimal ratio, BigDecimal momentum) {}

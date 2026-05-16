package com.ftm.app.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MacroIndicator(
        LocalDate observationDate,
        String seriesId,
        BigDecimal value,
        String source
) {}

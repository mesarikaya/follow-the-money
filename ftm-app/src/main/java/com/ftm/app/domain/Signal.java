package com.ftm.app.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record Signal(
    LocalDate signalDate,
    CategoryId categoryId,
    SignalType signalType,
    BigDecimal value,
    String metadata,
    OffsetDateTime computedAt) {}

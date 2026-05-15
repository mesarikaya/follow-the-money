package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;

public record MacroIndicatorId(LocalDate observationDate, String seriesId) implements Serializable {}

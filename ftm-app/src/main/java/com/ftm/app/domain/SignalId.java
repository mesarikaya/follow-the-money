package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;

public record SignalId(LocalDate signalDate, String categoryId, SignalType signalType) implements Serializable {}

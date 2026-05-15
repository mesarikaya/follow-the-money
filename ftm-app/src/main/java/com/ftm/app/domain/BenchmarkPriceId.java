package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;

public record BenchmarkPriceId(LocalDate tradeDate, String ticker) implements Serializable {}

package com.ftm.app.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record BenchmarkPrice(LocalDate tradeDate, String ticker, BigDecimal adjClose) {}

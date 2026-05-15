package com.ftm.app.domain;

import java.io.Serializable;
import java.time.LocalDate;

public record RawPriceId(LocalDate tradeDate, String categoryId) implements Serializable {}

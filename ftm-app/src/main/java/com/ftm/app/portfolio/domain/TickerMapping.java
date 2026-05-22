package com.ftm.app.portfolio.domain;

import java.time.OffsetDateTime;

public record TickerMapping(
    String ticker, String categoryId, String notes, OffsetDateTime updatedAt) {}

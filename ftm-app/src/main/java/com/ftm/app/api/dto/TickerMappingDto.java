package com.ftm.app.api.dto;

import java.time.OffsetDateTime;

public record TickerMappingDto(
    String ticker, String categoryId, String notes, OffsetDateTime updatedAt) {}

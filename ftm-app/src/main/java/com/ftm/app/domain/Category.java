package com.ftm.app.domain;

public record Category(
        CategoryId id,
        String name,
        CategoryType type,
        String etfTicker,
        String benchmarkTicker,
        Integer displayOrder,
        Boolean active,
        String parentId
) {}

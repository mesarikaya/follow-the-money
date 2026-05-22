package com.ftm.app.api.dto;

import java.math.BigDecimal;

public record SubSectorSummaryDto(
    String id,
    String name,
    String parentId,
    String etfTicker,
    BigDecimal rs20,
    BigDecimal rs60,
    BigDecimal rs120,
    BigDecimal momentum,
    String rrgQuadrant,
    BigDecimal compositeScore) {}

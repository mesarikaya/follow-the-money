package com.ftm.app.portfolio.domain;

public record HoldingCsvRow(
    String ticker,
    String name,
    String quantity,
    String currency,
    String avgCost) {}

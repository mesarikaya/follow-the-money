package com.ftm.app.portfolio.domain;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PortfolioValueSnapshot(
    LocalDate snapshotDate,
    BigDecimal totalValueEur,
    BigDecimal totalCostEur,
    int holdingCount) {}

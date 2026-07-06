package com.ftm.app.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record PortfolioResponse(
    List<PortfolioAllocationEntry> allocations,
    BigDecimal alignmentScore,
    String alignmentLabel,
    List<RebalanceSuggestionDto> rebalanceSuggestions) {
  public record PortfolioAllocationEntry(
      String categoryId,
      String categoryName,
      String categoryType,
      BigDecimal allocationPct,
      BigDecimal compositeScore,
      Integer momentumPct,
      BigDecimal optimalAllocationPct,
      String tradeSignal) {}
}

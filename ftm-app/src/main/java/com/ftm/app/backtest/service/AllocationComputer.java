package com.ftm.app.backtest.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Pure allocation logic: given composite scores and a set of investable categories, selects the
 * top-N categories by score at each rebalance date.
 *
 * <p>Extracted from BacktestEngine to enable direct unit testing of the filtering rules without
 * requiring a database connection.
 */
@Component
public class AllocationComputer {

  public Map<LocalDate, List<String>> computeAllocations(
      List<LocalDate> rebalanceDates,
      Map<LocalDate, Map<String, BigDecimal>> compositesByDate,
      int topN,
      BigDecimal signalThreshold,
      Set<String> categoriesWithPriceData) {
    return computeAllocations(
        rebalanceDates, compositesByDate, topN, signalThreshold, categoriesWithPriceData, false);
  }

  /**
   * @param invertSignal when true, selects the <em>lowest</em>-scoring categories (contrarian) —
   *     used to test whether the composite signal is anti-predictive at the rebalance horizon.
   */
  public Map<LocalDate, List<String>> computeAllocations(
      List<LocalDate> rebalanceDates,
      Map<LocalDate, Map<String, BigDecimal>> compositesByDate,
      int topN,
      BigDecimal signalThreshold,
      Set<String> categoriesWithPriceData,
      boolean invertSignal) {

    // Momentum default picks highest scores; contrarian picks lowest.
    Comparator<Map.Entry<String, BigDecimal>> byScore =
        invertSignal
            ? Map.Entry.comparingByValue()
            : Map.Entry.<String, BigDecimal>comparingByValue().reversed();

    Map<LocalDate, List<String>> allocations = new LinkedHashMap<>();
    List<String> lastAllocation = List.of();

    for (LocalDate rebalanceDate : rebalanceDates) {
      Map<String, BigDecimal> composites = findClosestComposites(rebalanceDate, compositesByDate);
      if (composites.isEmpty()) {
        allocations.put(rebalanceDate, lastAllocation);
        continue;
      }

      List<String> topCategories =
          composites.entrySet().stream()
              .filter(e -> e.getValue() != null)
              // Only allocate to categories that have price data — sub-sector ETFs that haven't
              // been ingested would otherwise make the portfolio flatline with 0% returns.
              .filter(e -> categoriesWithPriceData.contains(e.getKey()))
              .filter(e -> signalThreshold == null || e.getValue().compareTo(signalThreshold) >= 0)
              .sorted(byScore)
              .limit(topN)
              .map(Map.Entry::getKey)
              .toList();

      if (!topCategories.isEmpty()) {
        lastAllocation = topCategories;
      }
      allocations.put(rebalanceDate, lastAllocation);
    }
    return allocations;
  }

  private Map<String, BigDecimal> findClosestComposites(
      LocalDate targetDate, Map<LocalDate, Map<String, BigDecimal>> compositesByDate) {
    return compositesByDate.entrySet().stream()
        .filter(e -> !e.getKey().isAfter(targetDate))
        .max(Map.Entry.comparingByKey())
        .map(Map.Entry::getValue)
        .orElse(Map.of());
  }
}

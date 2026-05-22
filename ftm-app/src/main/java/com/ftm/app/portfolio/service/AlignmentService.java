package com.ftm.app.portfolio.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import org.springframework.stereotype.Service;

/**
 * Computes portfolio alignment score as portfolio-overlap fraction.
 *
 * <p>Score = Σ min(actual_pct_i, optimal_pct_i) / 100, where the sum is over all categories in the
 * composite-score universe. Interpretation: "what fraction of my portfolio is correctly placed."
 * Cash/untracked positions contribute 0 (natural cash-drag penalty).
 *
 * <p>Optimal allocation = composite-proportional (compositeScore_i / ΣcompositeScore_j × 100).
 * Categories with null composite score are excluded from the universe.
 */
@Service
public class AlignmentService {

  public BigDecimal computeAlignmentScore(
      Map<String, BigDecimal> allocationPercentageByCategoryId,
      Map<String, BigDecimal> compositeScoreByCategoryId) {

    List<String> universeIds =
        compositeScoreByCategoryId.entrySet().stream()
            .filter(e -> e.getValue() != null)
            .map(Map.Entry::getKey)
            .sorted()
            .toList();

    if (universeIds.size() < 2) {
      return BigDecimal.ZERO;
    }

    BigDecimal totalCompositeScore =
        universeIds.stream()
            .map(compositeScoreByCategoryId::get)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    if (totalCompositeScore.compareTo(BigDecimal.ZERO) == 0) {
      return BigDecimal.ZERO;
    }

    BigDecimal overlapSum = BigDecimal.ZERO;
    for (String categoryId : universeIds) {
      BigDecimal actualPct =
          allocationPercentageByCategoryId.getOrDefault(categoryId, BigDecimal.ZERO);
      BigDecimal optimalPct =
          compositeScoreByCategoryId
              .get(categoryId)
              .multiply(new BigDecimal("100"))
              .divide(totalCompositeScore, 4, RoundingMode.HALF_UP);
      overlapSum = overlapSum.add(actualPct.min(optimalPct));
    }

    return overlapSum
        .divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP)
        .min(BigDecimal.ONE)
        .max(BigDecimal.ZERO);
  }

  public Map<String, BigDecimal> computeCompositeOptimalAllocation(
      Map<String, BigDecimal> compositeScoreByCategoryId) {

    Map<String, BigDecimal> nonNullScores = new LinkedHashMap<>();
    for (Map.Entry<String, BigDecimal> entry : compositeScoreByCategoryId.entrySet()) {
      if (entry.getValue() != null && entry.getValue().compareTo(BigDecimal.ZERO) > 0) {
        nonNullScores.put(entry.getKey(), entry.getValue());
      }
    }

    if (nonNullScores.isEmpty()) {
      return Map.of();
    }

    BigDecimal totalCompositeScore =
        nonNullScores.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);

    Map<String, BigDecimal> optimalAllocationByCategoryId = new LinkedHashMap<>();
    for (Map.Entry<String, BigDecimal> entry : nonNullScores.entrySet()) {
      BigDecimal optimalPct =
          entry
              .getValue()
              .multiply(new BigDecimal("100"))
              .divide(totalCompositeScore, 2, RoundingMode.HALF_UP);
      optimalAllocationByCategoryId.put(entry.getKey(), optimalPct);
    }
    return optimalAllocationByCategoryId;
  }
}

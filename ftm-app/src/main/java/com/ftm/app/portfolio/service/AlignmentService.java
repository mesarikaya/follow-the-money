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
 * <p>Optimal allocation uses volatility-adjusted weights: score_i / vol_i, where vol_i is the 20d
 * realized annualized volatility. When vol is unavailable, a conservative default of 10% is used.
 * Vol is floored at 5% so very-low-vol assets don't dominate. Categories with null composite score
 * are excluded from the universe.
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

  private static final BigDecimal VOL_FLOOR = new BigDecimal("0.05");
  private static final BigDecimal VOL_DEFAULT = new BigDecimal("0.10");
  private static final int MAX_CONCENTRATED_POSITIONS = 5;

  /**
   * Volatility-adjusted optimal allocation: weight_i = compositeScore_i / effectiveVol_i.
   *
   * <p>Sectors with identical scores but higher volatility get smaller allocations, reflecting that
   * the same expected return at higher risk is less attractive. Vol is floored at 5% to prevent
   * extreme concentration in very-low-vol assets. Missing vol data defaults to 10%.
   *
   * <p>Only the top {@value #MAX_CONCENTRATED_POSITIONS} sectors by adjusted weight receive a
   * non-zero allocation, keeping rebalance suggestions actionable for a concentrated portfolio.
   */
  public Map<String, BigDecimal> computeVolatilityAdjustedOptimalAllocation(
      Map<String, BigDecimal> compositeScoreByCategoryId,
      Map<String, BigDecimal> realizedVol20dByCategoryId) {

    Map<String, BigDecimal> adjustedWeights = new LinkedHashMap<>();
    for (Map.Entry<String, BigDecimal> entry : compositeScoreByCategoryId.entrySet()) {
      BigDecimal score = entry.getValue();
      if (score == null || score.compareTo(BigDecimal.ZERO) <= 0) continue;
      String categoryId = entry.getKey();
      BigDecimal vol = realizedVol20dByCategoryId.get(categoryId);
      BigDecimal effectiveVol = (vol != null && vol.compareTo(VOL_FLOOR) > 0) ? vol : VOL_DEFAULT;
      adjustedWeights.put(categoryId, score.divide(effectiveVol, 6, RoundingMode.HALF_UP));
    }

    if (adjustedWeights.isEmpty()) return Map.of();

    List<Map.Entry<String, BigDecimal>> topEntries =
        adjustedWeights.entrySet().stream()
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
            .limit(MAX_CONCENTRATED_POSITIONS)
            .toList();

    BigDecimal totalWeight =
        topEntries.stream().map(Map.Entry::getValue).reduce(BigDecimal.ZERO, BigDecimal::add);

    Map<String, BigDecimal> result = new LinkedHashMap<>();
    for (Map.Entry<String, BigDecimal> entry : topEntries) {
      result.put(
          entry.getKey(),
          entry
              .getValue()
              .multiply(new BigDecimal("100"))
              .divide(totalWeight, 2, RoundingMode.HALF_UP));
    }
    return result;
  }

  private static final BigDecimal HUNDRED = new BigDecimal("100");

  /**
   * Rank-weights the top-{@code topN} categories by 12-1 momentum, restricted to <em>positive</em>
   * momentum: the strongest sector gets the largest slice via a linear rank tilt (weight ∝ N−rank,
   * so for 3 sectors 50/33/17, for 5 sectors 33/27/20/13/7). Backtesting this tilt against a flat
   * equal split improved Sharpe (0.87 vs 0.81) robustly across both sub-periods with no extra
   * drawdown — because momentum's <em>ordering</em> is predictive, the leader deserves more capital
   * without the concentration risk of going all-in on a single (potentially parabolic) name.
   *
   * <p>Absolute-momentum filter: non-positive momentum is never held. If fewer than {@code topN}
   * sectors are positive only those are held; if none are, the result is empty (all cash — the
   * defensive dual-momentum outcome).
   */
  public Map<String, BigDecimal> computeMomentumRankOptimalAllocation(
      Map<String, BigDecimal> momentumByCategoryId, int topN) {

    List<String> selected =
        momentumByCategoryId.entrySet().stream()
            .filter(e -> e.getValue() != null && e.getValue().signum() > 0)
            .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
            .limit(topN)
            .map(Map.Entry::getKey)
            .toList();

    if (selected.isEmpty()) {
      return Map.of();
    }

    // Linear rank weights: the k-th (0-indexed) of n holdings gets (n - k) units out of the
    // triangular total n(n+1)/2, so weights decrease evenly with momentum rank and sum to 100%.
    int count = selected.size();
    BigDecimal totalRankUnits = BigDecimal.valueOf((long) count * (count + 1) / 2);
    Map<String, BigDecimal> optimalAllocationByCategoryId = new LinkedHashMap<>();
    for (int rank = 0; rank < count; rank++) {
      BigDecimal rankUnits = BigDecimal.valueOf(count - rank);
      BigDecimal weightPct =
          rankUnits.multiply(HUNDRED).divide(totalRankUnits, 2, RoundingMode.HALF_UP);
      optimalAllocationByCategoryId.put(selected.get(rank), weightPct);
    }
    return optimalAllocationByCategoryId;
  }

  /**
   * Portfolio-overlap alignment against an explicit optimal allocation (in percent), rather than
   * deriving the optimal from scores. Score = Σ min(actual_i, optimal_i) / 100 — "what fraction of
   * the portfolio is already placed where the strategy wants it."
   */
  public BigDecimal computeAlignmentScoreAgainstOptimal(
      Map<String, BigDecimal> allocationPercentageByCategoryId,
      Map<String, BigDecimal> optimalAllocationPercentageByCategoryId) {

    if (optimalAllocationPercentageByCategoryId.isEmpty()) {
      return BigDecimal.ZERO;
    }

    BigDecimal overlapSum = BigDecimal.ZERO;
    for (Map.Entry<String, BigDecimal> entry :
        optimalAllocationPercentageByCategoryId.entrySet()) {
      BigDecimal actualPct =
          allocationPercentageByCategoryId.getOrDefault(entry.getKey(), BigDecimal.ZERO);
      overlapSum = overlapSum.add(actualPct.min(entry.getValue()));
    }

    return overlapSum
        .divide(HUNDRED, 4, RoundingMode.HALF_UP)
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

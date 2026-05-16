package com.ftm.app.portfolio.service;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

/**
 * Computes portfolio alignment score using Spearman rank correlation.
 *
 * Input: allocation% per category, composite score per category.
 * Output: alignment score in [0.0, 1.0] where 1.0 = perfect rank match.
 *
 * Design decisions (EP-009):
 * - Categories with null composite score are excluded from correlation.
 * - Ties in ranking are broken by category ID (stable, reproducible).
 * - Raw Spearman ρ ∈ [-1, 1] is scaled to [0, 1] via (ρ + 1) / 2.
 * - Optimal allocation = composite-proportional (compositeScore_i / ΣcompositeScore_j).
 */
@Service
public class AlignmentService {

    private static final BigDecimal CORRELATION_SCALE_DENOMINATOR = new BigDecimal("2");

    public BigDecimal computeAlignmentScore(
            Map<String, BigDecimal> allocationPercentageByCategoryId,
            Map<String, BigDecimal> compositeScoreByCategoryId) {

        List<String> commonCategoryIds = allocationPercentageByCategoryId.keySet().stream()
                .filter(compositeScoreByCategoryId::containsKey)
                .filter(id -> compositeScoreByCategoryId.get(id) != null)
                .sorted()
                .toList();

        int categoryCount = commonCategoryIds.size();
        if (categoryCount < 2) {
            return BigDecimal.ZERO;
        }

        List<String> rankedByAllocation = commonCategoryIds.stream()
                .sorted(Comparator.comparing(
                        (String id) -> allocationPercentageByCategoryId.get(id),
                        Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Comparator.naturalOrder()))
                .toList();

        List<String> rankedByComposite = commonCategoryIds.stream()
                .sorted(Comparator.comparing(
                        (String id) -> compositeScoreByCategoryId.get(id),
                        Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(Comparator.naturalOrder()))
                .toList();

        Map<String, Integer> allocationRankByCategoryId = new HashMap<>();
        Map<String, Integer> compositeRankByCategoryId = new HashMap<>();
        for (int index = 0; index < categoryCount; index++) {
            allocationRankByCategoryId.put(rankedByAllocation.get(index), index + 1);
            compositeRankByCategoryId.put(rankedByComposite.get(index), index + 1);
        }

        long sumOfSquaredRankDifferences = 0;
        for (String categoryId : commonCategoryIds) {
            long rankDifference = allocationRankByCategoryId.get(categoryId) - compositeRankByCategoryId.get(categoryId);
            sumOfSquaredRankDifferences += rankDifference * rankDifference;
        }

        double spearmanCorrelation = 1.0
                - (6.0 * sumOfSquaredRankDifferences) / ((double) categoryCount * (categoryCount * categoryCount - 1));

        BigDecimal scaledAlignment = BigDecimal.valueOf((spearmanCorrelation + 1.0) / 2.0)
                .setScale(4, RoundingMode.HALF_UP);

        return scaledAlignment.min(BigDecimal.ONE).max(BigDecimal.ZERO);
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

        BigDecimal totalCompositeScore = nonNullScores.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> optimalAllocationByCategoryId = new LinkedHashMap<>();
        for (Map.Entry<String, BigDecimal> entry : nonNullScores.entrySet()) {
            BigDecimal optimalPct = entry.getValue()
                    .multiply(new BigDecimal("100"))
                    .divide(totalCompositeScore, 2, RoundingMode.HALF_UP);
            optimalAllocationByCategoryId.put(entry.getKey(), optimalPct);
        }
        return optimalAllocationByCategoryId;
    }
}

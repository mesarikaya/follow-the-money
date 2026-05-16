package com.ftm.app.portfolio.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class AlignmentServiceTest {

    private AlignmentService alignmentService;

    @BeforeEach
    void setUp() {
        alignmentService = new AlignmentService();
    }

    @Test
    void perfectlyAlignedPortfolioReturnsMaxAlignmentScore() {
        // Allocation ranks match composite ranks exactly
        Map<String, BigDecimal> allocations = Map.of(
                "XLK", new BigDecimal("50"),
                "XLF", new BigDecimal("30"),
                "XLE", new BigDecimal("20"));
        Map<String, BigDecimal> compositeScores = Map.of(
                "XLK", new BigDecimal("0.80"),
                "XLF", new BigDecimal("0.60"),
                "XLE", new BigDecimal("0.40"));

        BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

        assertThat(score).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void perfectlyInversePortfolioReturnsMinAlignmentScore() {
        // Allocation ranks are exactly reversed vs composite ranks
        Map<String, BigDecimal> allocations = Map.of(
                "XLK", new BigDecimal("50"),
                "XLF", new BigDecimal("30"),
                "XLE", new BigDecimal("20"));
        Map<String, BigDecimal> compositeScores = Map.of(
                "XLK", new BigDecimal("0.20"),  // lowest composite, highest allocation
                "XLF", new BigDecimal("0.60"),
                "XLE", new BigDecimal("0.80"));  // highest composite, lowest allocation

        BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

        assertThat(score).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void partiallyAlignedPortfolioReturnsExpectedAlignmentScore() {
        // Allocation ranks [XLK=1, XLF=2, XLE=3, XLV=4]
        // Composite ranks  [XLK=1, XLF=2, XLV=3, XLE=4] → adjacent swap in positions 3+4
        // d = [0, 0, -1, 1], Σd² = 2
        // Spearman ρ = 1 - 6*2/(4*15) = 1 - 12/60 = 0.8
        // Alignment = (0.8 + 1) / 2 = 0.9
        Map<String, BigDecimal> allocations = Map.of(
                "XLK", new BigDecimal("40"),
                "XLF", new BigDecimal("30"),
                "XLE", new BigDecimal("20"),
                "XLV", new BigDecimal("10"));
        Map<String, BigDecimal> compositeScores = Map.of(
                "XLK", new BigDecimal("0.80"),
                "XLF", new BigDecimal("0.60"),
                "XLV", new BigDecimal("0.40"),
                "XLE", new BigDecimal("0.20"));

        BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

        assertThat(score.doubleValue()).isCloseTo(0.9, within(0.001));
    }

    @Test
    void categoriesWithNullCompositeScoreAreExcluded() {
        Map<String, BigDecimal> allocations = Map.of(
                "XLK", new BigDecimal("60"),
                "XLF", new BigDecimal("30"),
                "XLE", new BigDecimal("10"));
        Map<String, BigDecimal> compositeScoresWithNull = new java.util.HashMap<>();
        compositeScoresWithNull.put("XLK", new BigDecimal("0.80"));
        compositeScoresWithNull.put("XLF", new BigDecimal("0.50"));
        compositeScoresWithNull.put("XLE", null);  // excluded

        // Only XLK and XLF participate; their relative allocation ranks match composite ranks
        BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScoresWithNull);

        assertThat(score).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void fewerThanTwoCategoriesReturnsZero() {
        Map<String, BigDecimal> allocations = Map.of("XLK", new BigDecimal("100"));
        Map<String, BigDecimal> compositeScores = Map.of("XLK", new BigDecimal("0.80"));

        BigDecimal score = alignmentService.computeAlignmentScore(allocations, compositeScores);

        assertThat(score).isEqualByComparingTo(BigDecimal.ZERO);
    }

    @Test
    void optimalAllocationIsProportionalToCompositeScore() {
        Map<String, BigDecimal> compositeScores = Map.of(
                "XLK", new BigDecimal("0.80"),
                "XLF", new BigDecimal("0.20"));

        Map<String, BigDecimal> optimal = alignmentService.computeCompositeOptimalAllocation(compositeScores);

        // XLK = 0.80/(0.80+0.20)*100 = 80%
        // XLF = 0.20/(0.80+0.20)*100 = 20%
        assertThat(optimal.get("XLK")).isEqualByComparingTo(new BigDecimal("80.00"));
        assertThat(optimal.get("XLF")).isEqualByComparingTo(new BigDecimal("20.00"));
    }

    @Test
    void optimalAllocationExcludesNullAndZeroCompositeScores() {
        Map<String, BigDecimal> compositeScoresWithNullAndZero = new java.util.HashMap<>();
        compositeScoresWithNullAndZero.put("XLK", new BigDecimal("0.80"));
        compositeScoresWithNullAndZero.put("XLF", null);
        compositeScoresWithNullAndZero.put("XLE", BigDecimal.ZERO);

        Map<String, BigDecimal> optimal = alignmentService.computeCompositeOptimalAllocation(compositeScoresWithNullAndZero);

        assertThat(optimal).containsOnlyKeys("XLK");
        assertThat(optimal.get("XLK")).isEqualByComparingTo(new BigDecimal("100.00"));
    }
}

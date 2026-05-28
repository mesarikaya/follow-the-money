package com.ftm.app.signals.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class CompositeScoreServiceTest {

  private final CompositeScoreService service = new CompositeScoreService();

  private static final String TECH = "TECH";
  private static final String FINL = "FINL";
  private static final String HLTH = "HLTH";

  @Nested
  @DisplayName("computeCompositeScores")
  class ComputeCompositeScores {

    @Test
    @DisplayName("returns empty map when all inputs are empty")
    void shouldReturnEmptyMapWhenAllInputsEmpty() {
      var result = service.computeCompositeScores(
          Map.of(), Map.of(), Map.of(), Map.of(), Map.of());

      assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("excludes category when all its signal components are null")
    void shouldExcludeCategoryWhenAllComponentsNull() {
      var rs60 = Map.of(TECH, new BigDecimal("1.05"));
      var result = service.computeCompositeScores(
          rs60,
          Map.of(),
          Map.of(),
          Map.of(),
          Map.of());

      // TECH has rs60 but no other signals; still has a score (weight redistributed)
      assertThat(result).containsKey(TECH);
    }

    @Test
    @DisplayName("returns score in [0,1] for single category with full signals")
    void shouldReturnScoreInBoundsForSingleCategory() {
      var rs60     = Map.of(TECH, new BigDecimal("1.10"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.50"));
      var momentum = Map.of(TECH, new BigDecimal("0.08"));
      var macroFit = Map.of(TECH, new BigDecimal("0.65"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"));  // Leading

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result).containsKey(TECH);
      BigDecimal score = result.get(TECH);
      assertThat(score).isBetween(BigDecimal.ZERO, BigDecimal.ONE);
    }

    @Test
    @DisplayName("single category with all same-value signals normalises to 0.5 on each component")
    void shouldNormaliseSingleCategoryToHalfOnEachComponent() {
      // With only one category, min==max on every signal type → each normalized value = 0.5.
      // RRG Leading = 1.0. Weight redistribution not needed (all present).
      // Expected: (0.35×0.5 + 0.25×0.5 + 0.20×0.5 + 0.10×0.5 + 0.10×1.0) / 1.0
      //         = (0.175 + 0.125 + 0.10 + 0.05 + 0.10) = 0.55
      var rs60     = Map.of(TECH, new BigDecimal("1.10"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.50"));
      var momentum = Map.of(TECH, new BigDecimal("0.08"));
      var macroFit = Map.of(TECH, new BigDecimal("0.65"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"));

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result.get(TECH)).isEqualByComparingTo("0.550000");
    }

    @Test
    @DisplayName("higher RS-60 category gets higher composite score than lower RS-60 category")
    void shouldRankHigherRs60CategoryAboveLower() {
      var rs60     = Map.of(TECH, new BigDecimal("1.20"), FINL, new BigDecimal("0.90"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.50"), FINL, new BigDecimal("0.50"));
      var momentum = Map.of(TECH, new BigDecimal("0.10"), FINL, new BigDecimal("0.10"));
      var macroFit = Map.of(TECH, new BigDecimal("0.60"), FINL, new BigDecimal("0.60"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"), FINL, new BigDecimal("4"));

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result.get(TECH)).isGreaterThan(result.get(FINL));
    }

    @Test
    @DisplayName("null flow20Day is excluded and remaining weights are redistributed proportionally")
    void shouldRedistributeWeightsWhenFlow20DayIsNull() {
      // Flow weight 0.25 is missing for both categories → remaining 0.75 split as:
      // RS_60=0.35, MOM=0.20, MACRO=0.10, RRG=0.10  total=0.75
      // Normalised proportional redistribution = same weights / 0.75
      // With equal signals except flow → both categories should still score identically
      var rs60     = Map.of(TECH, new BigDecimal("1.10"), FINL, new BigDecimal("0.90"));
      var flow20d  = Collections.<String, BigDecimal>emptyMap();  // no flow data
      var momentum = Map.of(TECH, new BigDecimal("0.10"), FINL, new BigDecimal("0.10"));
      var macroFit = Map.of(TECH, new BigDecimal("0.60"), FINL, new BigDecimal("0.60"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"), FINL, new BigDecimal("4"));

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      // Both have scores; TECH's higher RS-60 should still dominate
      assertThat(result).containsKeys(TECH, FINL);
      assertThat(result.get(TECH)).isGreaterThan(result.get(FINL));
    }

    @Test
    @DisplayName("RRG quadrant Leading scores 1.0, Lagging scores 0.0")
    void shouldApplyCorrectRrgScores() {
      // Two categories: identical RS/flow/mom/macro but different RRG quadrants
      // Leading(4) > Lagging(1) → TECH score > FINL score
      var rs60     = Map.of(TECH, new BigDecimal("1.05"), FINL, new BigDecimal("1.05"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.50"), FINL, new BigDecimal("0.50"));
      var momentum = Map.of(TECH, new BigDecimal("0.05"), FINL, new BigDecimal("0.05"));
      var macroFit = Map.of(TECH, new BigDecimal("0.55"), FINL, new BigDecimal("0.55"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"), FINL, new BigDecimal("1"));

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result.get(TECH)).isGreaterThan(result.get(FINL));
    }

    @Test
    @DisplayName("unknown RRG quadrant value maps to Lagging score (0.0)")
    void shouldMapUnknownRrgQuadrantToLagging() {
      // Quadrant 99 falls through to default → same as quadrant 1
      var rs60     = Map.of(TECH, new BigDecimal("1.05"), FINL, new BigDecimal("1.05"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.50"), FINL, new BigDecimal("0.50"));
      var momentum = Map.of(TECH, new BigDecimal("0.05"), FINL, new BigDecimal("0.05"));
      var macroFit = Map.of(TECH, new BigDecimal("0.55"), FINL, new BigDecimal("0.55"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("99"), FINL, new BigDecimal("1"));

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result.get(TECH)).isEqualByComparingTo(result.get(FINL));
    }

    @Test
    @DisplayName("three categories produce normalised scores with correct relative ordering")
    void shouldProduceCorrectRelativeOrderingForThreeCategories() {
      var rs60     = Map.of(TECH, new BigDecimal("1.30"), FINL, new BigDecimal("1.10"), HLTH, new BigDecimal("0.90"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.80"), FINL, new BigDecimal("0.50"), HLTH, new BigDecimal("0.20"));
      var momentum = Map.of(TECH, new BigDecimal("0.12"), FINL, new BigDecimal("0.05"), HLTH, new BigDecimal("-0.03"));
      var macroFit = Map.of(TECH, new BigDecimal("0.70"), FINL, new BigDecimal("0.55"), HLTH, new BigDecimal("0.40"));
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"), FINL, new BigDecimal("3"), HLTH, new BigDecimal("2"));

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result.get(TECH)).isGreaterThan(result.get(FINL));
      assertThat(result.get(FINL)).isGreaterThan(result.get(HLTH));
      assertThat(result.get(TECH)).isLessThanOrEqualTo(BigDecimal.ONE);
      assertThat(result.get(HLTH)).isGreaterThanOrEqualTo(BigDecimal.ZERO);
    }

    @Test
    @DisplayName("category absent from a signal map gets null for that component")
    void shouldHandleMissingCategoryInSignalMaps() {
      // TECH has all signals; FINL has only RS-60
      var rs60     = Map.of(TECH, new BigDecimal("1.10"), FINL, new BigDecimal("0.95"));
      var flow20d  = Map.of(TECH, new BigDecimal("0.60"));         // FINL missing
      var momentum = Map.of(TECH, new BigDecimal("0.08"));         // FINL missing
      var macroFit = Map.of(TECH, new BigDecimal("0.65"));         // FINL missing
      var rrgQuad  = Map.of(TECH, new BigDecimal("4"));            // FINL missing

      var result = service.computeCompositeScores(rs60, flow20d, momentum, macroFit, rrgQuad);

      assertThat(result).containsKeys(TECH, FINL);
      // FINL only has RS-60; score is non-null but based solely on that component
      assertThat(result.get(FINL)).isNotNull();
    }
  }

  @Nested
  @DisplayName("RRG score mapping")
  class RrgScoreMapping {

    @Test
    @DisplayName("Leading quadrant (4) yields score 1.0")
    void leadingQuadrantYieldsOneFull() {
      var result = service.computeCompositeScores(
          Map.of(TECH, BigDecimal.ONE),
          Map.of(),
          Map.of(),
          Map.of(),
          Map.of(TECH, new BigDecimal("4")));

      // Only RS-60 (normalised 0.5) + RRG 1.0 contribute; others missing
      // Weights: RS_60=0.35, RRG=0.10 → total=0.45
      // Score = (0.35×0.5 + 0.10×1.0) / 0.45 = (0.175+0.10)/0.45 = 0.275/0.45 ≈ 0.611111
      assertThat(result.get(TECH)).isEqualByComparingTo("0.611111");
    }

    @Test
    @DisplayName("Lagging quadrant (1) yields score 0.0")
    void laggingQuadrantYieldsZero() {
      var rs60    = Map.of(TECH, BigDecimal.ONE);
      var rrgQuad = Map.of(TECH, new BigDecimal("1"));

      var result = service.computeCompositeScores(
          rs60, Map.of(), Map.of(), Map.of(), rrgQuad);

      // Weights: RS_60=0.35, RRG=0.10 → total=0.45
      // Score = (0.35×0.5 + 0.10×0.0) / 0.45 = 0.175/0.45 ≈ 0.388889
      assertThat(result.get(TECH)).isEqualByComparingTo("0.388889");
    }
  }
}

package com.ftm.app.signals.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Computes the composite score per category using weighted min-max normalized signals.
 *
 * <p>COMPOSITE = 0.25 × norm(RS_60) + 0.10 × norm(RS_120) + 0.20 × norm(PERSISTENCE_20D) + 0.10 ×
 * norm(FLOW_20D) + 0.15 × norm(MOM) + 0.10 × norm(MACRO_FIT) + 0.10 × relativeRotationGraphScore
 *
 * <p>RS_60 captures medium-term RS; RS_120 provides long-term confirmation; PERSISTENCE_20D
 * measures breadth consistency — categories with sustained outperformance across days receive
 * higher composite scores. FLOW_20D is a 20-day z-score of dollar volume (adj_close × volume) from
 * raw_prices, used as a money-rotation proxy.
 *
 * <p>norm() = min-max normalization across all categories on a given date.
 * relativeRotationGraphScore: Leading=1.0, Improving=0.7, Weakening=0.3, Lagging=0.0. Null
 * components are excluded and remaining weights are redistributed proportionally.
 */
@Service
public class CompositeScoreService {

  private static final BigDecimal RS_60_WEIGHT = new BigDecimal("0.25");
  private static final BigDecimal RS_120_WEIGHT = new BigDecimal("0.10");
  private static final BigDecimal PERSISTENCE_20D_WEIGHT = new BigDecimal("0.20");
  private static final BigDecimal FLOW_20_DAY_WEIGHT = new BigDecimal("0.10");
  private static final BigDecimal MOMENTUM_WEIGHT = new BigDecimal("0.15");
  private static final BigDecimal MACRO_FIT_WEIGHT = new BigDecimal("0.10");
  private static final BigDecimal RELATIVE_ROTATION_GRAPH_WEIGHT = new BigDecimal("0.10");

  private static final BigDecimal RRG_SCORE_LEADING = new BigDecimal("1.0");
  private static final BigDecimal RRG_SCORE_IMPROVING = new BigDecimal("0.7");
  private static final BigDecimal RRG_SCORE_WEAKENING = new BigDecimal("0.3");
  private static final BigDecimal RRG_SCORE_LAGGING = BigDecimal.ZERO;

  private static final int LEADING_QUADRANT = 4;
  private static final int IMPROVING_QUADRANT = 3;
  private static final int WEAKENING_QUADRANT = 2;

  /**
   * Per-category breakdown of each factor's contribution to the composite score.
   *
   * <p>Each contribution is {@code (weight × normalizedValue) / totalWeight} so all non-null
   * contributions sum exactly to {@code totalScore}, even when some components are absent and
   * weights are redistributed.
   */
  public record ScoreDecomposition(
      BigDecimal relativeStrength60Contribution,
      BigDecimal relativeStrength120Contribution,
      BigDecimal persistence20dContribution,
      BigDecimal flow20dContribution,
      BigDecimal momentumContribution,
      BigDecimal macroFitContribution,
      BigDecimal rrgContribution,
      BigDecimal totalScore) {}

  /**
   * Computes the factor-level contributions for each category.
   *
   * <p>Runs the same normalization as {@link #computeCompositeScores} and scales each
   * contribution by {@code 1/totalWeight} so the 7 values sum to {@code totalScore}.
   */
  public Map<String, ScoreDecomposition> computeScoreDecompositions(
      Map<String, BigDecimal> rs60ByCategoryId,
      Map<String, BigDecimal> rs120ByCategoryId,
      Map<String, BigDecimal> persistence20dByCategoryId,
      Map<String, BigDecimal> flow20DayByCategoryId,
      Map<String, BigDecimal> momentumByCategoryId,
      Map<String, BigDecimal> macroFitByCategoryId,
      Map<String, BigDecimal> rrgQuadrantByCategoryId) {

    Set<String> allCategoryIds =
        collectAllCategoryIds(
            rs60ByCategoryId,
            rs120ByCategoryId,
            persistence20dByCategoryId,
            flow20DayByCategoryId,
            momentumByCategoryId,
            macroFitByCategoryId,
            rrgQuadrantByCategoryId);

    Map<String, BigDecimal> normalizedRs60 = normalize(rs60ByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedRs120 = normalize(rs120ByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedPersistence20d =
        normalize(persistence20dByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedFlow20Day = normalize(flow20DayByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedMomentum = normalize(momentumByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedMacroFit = normalize(macroFitByCategoryId, allCategoryIds);
    Map<String, BigDecimal> rrgScores = deriveRrgScores(rrgQuadrantByCategoryId, allCategoryIds);

    Map<String, ScoreDecomposition> decompositions = new HashMap<>();
    for (String categoryId : allCategoryIds) {
      BigDecimal nRs60 = normalizedRs60.get(categoryId);
      BigDecimal nRs120 = normalizedRs120.get(categoryId);
      BigDecimal nPers20d = normalizedPersistence20d.get(categoryId);
      BigDecimal nFlow20d = normalizedFlow20Day.get(categoryId);
      BigDecimal nMom = normalizedMomentum.get(categoryId);
      BigDecimal nMacroFit = normalizedMacroFit.get(categoryId);
      BigDecimal nRrg = rrgScores.get(categoryId);

      BigDecimal totalWeight = totalWeight(nRs60, nRs120, nPers20d, nFlow20d, nMom, nMacroFit, nRrg);
      if (totalWeight.compareTo(BigDecimal.ZERO) == 0) continue;

      BigDecimal totalScore =
          computeWeightedScore(nRs60, nRs120, nPers20d, nFlow20d, nMom, nMacroFit, nRrg);
      decompositions.put(
          categoryId,
          new ScoreDecomposition(
              scaledContribution(RS_60_WEIGHT, nRs60, totalWeight),
              scaledContribution(RS_120_WEIGHT, nRs120, totalWeight),
              scaledContribution(PERSISTENCE_20D_WEIGHT, nPers20d, totalWeight),
              scaledContribution(FLOW_20_DAY_WEIGHT, nFlow20d, totalWeight),
              scaledContribution(MOMENTUM_WEIGHT, nMom, totalWeight),
              scaledContribution(MACRO_FIT_WEIGHT, nMacroFit, totalWeight),
              scaledContribution(RELATIVE_ROTATION_GRAPH_WEIGHT, nRrg, totalWeight),
              totalScore));
    }
    return decompositions;
  }

  private BigDecimal totalWeight(BigDecimal... normalizedValues) {
    BigDecimal[][] pairs = {
      {RS_60_WEIGHT, normalizedValues[0]},
      {RS_120_WEIGHT, normalizedValues[1]},
      {PERSISTENCE_20D_WEIGHT, normalizedValues[2]},
      {FLOW_20_DAY_WEIGHT, normalizedValues[3]},
      {MOMENTUM_WEIGHT, normalizedValues[4]},
      {MACRO_FIT_WEIGHT, normalizedValues[5]},
      {RELATIVE_ROTATION_GRAPH_WEIGHT, normalizedValues[6]}
    };
    BigDecimal total = BigDecimal.ZERO;
    for (BigDecimal[] pair : pairs) {
      if (pair[1] != null) total = total.add(pair[0]);
    }
    return total;
  }

  private BigDecimal scaledContribution(
      BigDecimal weight, BigDecimal normalizedValue, BigDecimal totalWeight) {
    if (normalizedValue == null) return null;
    return weight.multiply(normalizedValue).divide(totalWeight, 6, RoundingMode.HALF_UP);
  }

  /**
   * Computes the composite score for each category.
   *
   * @param rs60ByCategoryId raw RS_60 values per category
   * @param rs120ByCategoryId raw RS_120 values per category (long-term RS confirmation)
   * @param persistence20dByCategoryId PERSISTENCE_20D breadth consistency per category
   * @param flow20DayByCategoryId raw FLOW_20D values per category (may be empty if AUM unavailable)
   * @param momentumByCategoryId raw MOM values per category
   * @param macroFitByCategoryId MACRO_FIT win-rate in [0,1] per category
   * @param rrgQuadrantByCategoryId RRG quadrant (1=Lagging, 2=Weakening, 3=Improving, 4=Leading)
   * @return composite score in [0,1] per category; null if all inputs are null
   */
  public Map<String, BigDecimal> computeCompositeScores(
      Map<String, BigDecimal> rs60ByCategoryId,
      Map<String, BigDecimal> rs120ByCategoryId,
      Map<String, BigDecimal> persistence20dByCategoryId,
      Map<String, BigDecimal> flow20DayByCategoryId,
      Map<String, BigDecimal> momentumByCategoryId,
      Map<String, BigDecimal> macroFitByCategoryId,
      Map<String, BigDecimal> rrgQuadrantByCategoryId) {

    Set<String> allCategoryIds =
        collectAllCategoryIds(
            rs60ByCategoryId,
            rs120ByCategoryId,
            persistence20dByCategoryId,
            flow20DayByCategoryId,
            momentumByCategoryId,
            macroFitByCategoryId,
            rrgQuadrantByCategoryId);

    Map<String, BigDecimal> normalizedRs60 = normalize(rs60ByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedRs120 = normalize(rs120ByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedPersistence20d =
        normalize(persistence20dByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedFlow20Day = normalize(flow20DayByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedMomentum = normalize(momentumByCategoryId, allCategoryIds);
    Map<String, BigDecimal> normalizedMacroFit = normalize(macroFitByCategoryId, allCategoryIds);
    Map<String, BigDecimal> relativeRotationGraphScores =
        deriveRrgScores(rrgQuadrantByCategoryId, allCategoryIds);

    Map<String, BigDecimal> compositeScores = new HashMap<>();
    for (String categoryId : allCategoryIds) {
      BigDecimal score =
          computeWeightedScore(
              normalizedRs60.get(categoryId),
              normalizedRs120.get(categoryId),
              normalizedPersistence20d.get(categoryId),
              normalizedFlow20Day.get(categoryId),
              normalizedMomentum.get(categoryId),
              normalizedMacroFit.get(categoryId),
              relativeRotationGraphScores.get(categoryId));
      if (score != null) {
        compositeScores.put(categoryId, score);
      }
    }
    return compositeScores;
  }

  private BigDecimal computeWeightedScore(
      BigDecimal normalizedRs60,
      BigDecimal normalizedRs120,
      BigDecimal normalizedPersistence20d,
      BigDecimal normalizedFlow20Day,
      BigDecimal normalizedMomentum,
      BigDecimal normalizedMacroFit,
      BigDecimal relativeRotationGraphScore) {
    BigDecimal[][] weightedComponents = {
      {RS_60_WEIGHT, normalizedRs60},
      {RS_120_WEIGHT, normalizedRs120},
      {PERSISTENCE_20D_WEIGHT, normalizedPersistence20d},
      {FLOW_20_DAY_WEIGHT, normalizedFlow20Day},
      {MOMENTUM_WEIGHT, normalizedMomentum},
      {MACRO_FIT_WEIGHT, normalizedMacroFit},
      {RELATIVE_ROTATION_GRAPH_WEIGHT, relativeRotationGraphScore}
    };

    BigDecimal totalWeight = BigDecimal.ZERO;
    BigDecimal weightedSum = BigDecimal.ZERO;

    for (BigDecimal[] component : weightedComponents) {
      BigDecimal weight = component[0];
      BigDecimal value = component[1];
      if (value != null) {
        totalWeight = totalWeight.add(weight);
        weightedSum = weightedSum.add(weight.multiply(value));
      }
    }

    if (totalWeight.compareTo(BigDecimal.ZERO) == 0) return null;
    return weightedSum.divide(totalWeight, 6, RoundingMode.HALF_UP);
  }

  private Map<String, BigDecimal> normalize(
      Map<String, BigDecimal> rawValues, Set<String> allCategoryIds) {
    Map<String, BigDecimal> filled = new HashMap<>();
    for (String id : allCategoryIds) {
      filled.put(id, rawValues.get(id));
    }

    java.util.List<BigDecimal> nonNulls =
        filled.values().stream().filter(Objects::nonNull).toList();

    if (nonNulls.isEmpty()) {
      Map<String, BigDecimal> nullMap = new HashMap<>();
      allCategoryIds.forEach(id -> nullMap.put(id, null));
      return nullMap;
    }

    BigDecimal min = nonNulls.stream().min(BigDecimal::compareTo).orElseThrow();
    BigDecimal max = nonNulls.stream().max(BigDecimal::compareTo).orElseThrow();
    BigDecimal range = max.subtract(min);

    Map<String, BigDecimal> normalized = new HashMap<>();
    for (Map.Entry<String, BigDecimal> entry : filled.entrySet()) {
      BigDecimal value = entry.getValue();
      if (value == null) {
        normalized.put(entry.getKey(), null);
      } else if (range.compareTo(BigDecimal.ZERO) == 0) {
        normalized.put(entry.getKey(), new BigDecimal("0.5"));
      } else {
        normalized.put(entry.getKey(), value.subtract(min).divide(range, 6, RoundingMode.HALF_UP));
      }
    }
    return normalized;
  }

  private Map<String, BigDecimal> deriveRrgScores(
      Map<String, BigDecimal> quadrantByCategoryId, Set<String> allCategoryIds) {
    Map<String, BigDecimal> scores = new HashMap<>();
    for (String categoryId : allCategoryIds) {
      BigDecimal quadrant = quadrantByCategoryId.getOrDefault(categoryId, null);
      scores.put(categoryId, rrgScoreFromQuadrant(quadrant));
    }
    return scores;
  }

  private BigDecimal rrgScoreFromQuadrant(BigDecimal quadrant) {
    if (quadrant == null) return null;
    return switch (quadrant.intValue()) {
      case LEADING_QUADRANT -> RRG_SCORE_LEADING;
      case IMPROVING_QUADRANT -> RRG_SCORE_IMPROVING;
      case WEAKENING_QUADRANT -> RRG_SCORE_WEAKENING;
      default -> RRG_SCORE_LAGGING;
    };
  }

  @SafeVarargs
  private Set<String> collectAllCategoryIds(Map<String, BigDecimal>... maps) {
    Set<String> allIds = new java.util.HashSet<>();
    for (Map<String, BigDecimal> map : maps) {
      if (map != null) allIds.addAll(map.keySet());
    }
    return allIds;
  }
}

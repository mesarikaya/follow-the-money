package com.ftm.app.api.service;

import com.ftm.app.api.dto.ApproachingSignalDto;
import com.ftm.app.api.dto.CategorySummaryDto;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Component;

/**
 * Projects when each category's composite score will cross the next signal threshold given its
 * current 5-day momentum velocity. All projections assume momentum continues at the 5-day rate — a
 * rough but useful near-term estimate. Only predictions within 1–30 trading days are returned.
 *
 * <p>Threshold targets:
 *
 * <ul>
 *   <li>WATCH → BUY : score must reach 0.65 with improving RRG quadrant (3 or 4)
 *   <li>HOLD → WATCH : score must reach 0.50 while trending positive
 *   <li>BUY → WATCH : score must fall to 0.65 (signal weakening)
 *   <li>HOLD/WATCH → REDUCE : score must fall to 0.35 with weakening quadrant
 * </ul>
 */
@Component
public class SignalTransitionPredictor {

  private static final BigDecimal BUY_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal WATCH_THRESHOLD = new BigDecimal("0.50");
  private static final BigDecimal REDUCE_THRESHOLD = new BigDecimal("0.35");
  private static final BigDecimal VELOCITY_DIVISOR = new BigDecimal("5");
  private static final int MIN_DAYS = 1;
  private static final int MAX_DAYS = 30;

  /**
   * Projects upcoming signal transitions for all provided categories.
   *
   * @param categories all CategorySummaryDto instances from the signal engine
   * @return approaching signals sorted by estimated days ascending (most imminent first)
   */
  public List<ApproachingSignalDto> projectTransitions(List<CategorySummaryDto> categories) {
    return categories.stream()
        .map(this::tryProject)
        .filter(Objects::nonNull)
        .sorted(Comparator.comparingInt(ApproachingSignalDto::estimatedDays))
        .toList();
  }

  private ApproachingSignalDto tryProject(CategorySummaryDto category) {
    if (category.compositeScore() == null || category.compositeTrend5d() == null) return null;

    String signal = resolveSignal(category);
    BigDecimal velocity =
        category.compositeTrend5d().divide(VELOCITY_DIVISOR, 6, RoundingMode.HALF_UP);

    if (velocity.compareTo(BigDecimal.ZERO) == 0) return null;

    boolean rising = velocity.compareTo(BigDecimal.ZERO) > 0;
    BigDecimal score = category.compositeScore();
    int quadrant = quadrantOf(category);
    boolean improvingQuadrant = quadrant == 3 || quadrant == 4;
    boolean weakeningQuadrant = quadrant == 1 || quadrant == 2;

    // Approaching BUY: WATCH or HOLD rising toward 0.65 with improving quadrant
    if (rising && improvingQuadrant && ("WATCH".equals(signal) || "HOLD".equals(signal))) {
      if (score.compareTo(BUY_THRESHOLD) < 0) {
        BigDecimal gap = BUY_THRESHOLD.subtract(score);
        int days = ceilDays(gap, velocity);
        if (inRange(days)) {
          return build(category, signal, "BUY", days, score, gap, velocity);
        }
      }
    }

    // Approaching WATCH from HOLD: rising toward 0.50
    if (rising && "HOLD".equals(signal) && score.compareTo(WATCH_THRESHOLD) < 0) {
      BigDecimal gap = WATCH_THRESHOLD.subtract(score);
      int days = ceilDays(gap, velocity);
      if (inRange(days)) {
        return build(category, signal, "WATCH", days, score, gap, velocity);
      }
    }

    // BUY degrading toward WATCH: falling back through 0.65
    if (!rising && "BUY".equals(signal) && score.compareTo(BUY_THRESHOLD) > 0) {
      BigDecimal gap = score.subtract(BUY_THRESHOLD);
      BigDecimal absVelocity = velocity.abs();
      int days = ceilDays(gap, absVelocity);
      if (inRange(days)) {
        return build(category, signal, "WATCH", days, score, gap.negate(), velocity);
      }
    }

    // Approaching REDUCE: falling toward 0.35 with weakening quadrant
    if (!rising && weakeningQuadrant && ("HOLD".equals(signal) || "WATCH".equals(signal))) {
      if (score.compareTo(REDUCE_THRESHOLD) > 0) {
        BigDecimal gap = score.subtract(REDUCE_THRESHOLD);
        BigDecimal absVelocity = velocity.abs();
        int days = ceilDays(gap, absVelocity);
        if (inRange(days)) {
          return build(category, signal, "REDUCE", days, score, gap.negate(), velocity);
        }
      }
    }

    return null;
  }

  private String resolveSignal(CategorySummaryDto category) {
    if (category.tradeSignal() != null) return category.tradeSignal();
    return TradeSignalDeriver.derive(
        category.compositeScore(), category.rrgQuadrant(), category.compositeTrend20d());
  }

  private int quadrantOf(CategorySummaryDto category) {
    if (category.rrgQuadrant() == null) return 0;
    try {
      return Integer.parseInt(category.rrgQuadrant());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private int ceilDays(BigDecimal gap, BigDecimal absVelocity) {
    if (absVelocity.compareTo(BigDecimal.ZERO) == 0) return Integer.MAX_VALUE;
    return gap.divide(absVelocity, 0, RoundingMode.CEILING).intValue();
  }

  private boolean inRange(int days) {
    return days >= MIN_DAYS && days <= MAX_DAYS;
  }

  private String confidenceFor(int days) {
    if (days <= 7) return "HIGH";
    if (days <= 15) return "MEDIUM";
    return "LOW";
  }

  private ApproachingSignalDto build(
      CategorySummaryDto category,
      String currentSignal,
      String projectedSignal,
      int days,
      BigDecimal score,
      BigDecimal gap,
      BigDecimal velocity) {
    String categoryId = category.id() != null ? category.id().name() : null;
    return new ApproachingSignalDto(
        categoryId,
        category.name(),
        category.etfTicker(),
        currentSignal,
        projectedSignal,
        days,
        score.setScale(3, RoundingMode.HALF_UP),
        gap.setScale(3, RoundingMode.HALF_UP),
        velocity.round(new MathContext(4, RoundingMode.HALF_UP)),
        confidenceFor(days));
  }
}

package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Early heads-up alerts for a composite score entering a threshold-approach zone on the transition
 * day (was outside the zone yesterday):
 *
 * <ul>
 *   <li>BUY approach — score climbs into 0.55–0.65 (about to cross the BUY line).
 *   <li>REDUCE approach — score falls into 0.35–0.45 (about to cross the REDUCE line).
 * </ul>
 *
 * Each direction is suppressed when the corresponding formal trade-signal alert is already active
 * for the sector. Resolution is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class ScoreApproachingSignalEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ScoreApproachingSignalEvaluator.class);

  private static final String RULE_SCORE_APPROACHING_BUY = "score_approaching_buy";
  private static final String RULE_SCORE_APPROACHING_REDUCE = "score_approaching_reduce";
  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";
  private static final String RULE_TRADE_SIGNAL_REDUCE = "trade_signal_reduce";

  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");
  private static final BigDecimal APPROACHING_BUY_LOWER = new BigDecimal("0.55");
  private static final BigDecimal APPROACHING_REDUCE_UPPER = new BigDecimal("0.45");
  private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ScoreApproachingSignalEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    return evaluateApproachingBuy(context) + evaluateApproachingReduce(context);
  }

  private int evaluateApproachingBuy(AlertEvaluationContext context) {
    Optional<AlertRule> approachRule = alertRulesRepository.findById(RULE_SCORE_APPROACHING_BUY);
    if (!approachRule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = approachRule.map(AlertRule::severity).orElse(Severity.INFO);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> trend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    Map<String, BigDecimal> prevComposite = previousComposite(signalDate);

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = composite.get(categoryId);
      if (score == null) continue;

      boolean inApproachZone =
          score.compareTo(APPROACHING_BUY_LOWER) >= 0 && score.compareTo(BUY_SCORE_THRESHOLD) < 0;
      if (!inApproachZone) continue;

      BigDecimal prevScore = prevComposite.get(categoryId);
      boolean wasBelow = prevScore == null || prevScore.compareTo(APPROACHING_BUY_LOWER) < 0;
      if (!wasBelow) continue;

      if (alertRepository.existsActiveAlert(RULE_SCORE_APPROACHING_BUY, categoryId)) continue;
      if (alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId)) continue;

      CategoryId catId = parseCategory(categoryId, "score_approaching_buy");
      if (catId == null) continue;

      int scorePct = toPercent(score);
      int ptsNeeded = toPercent(BUY_SCORE_THRESHOLD) - scorePct;
      int rrgInt = rrgQuadrant(rrgQuadrant, categoryId);
      BigDecimal trend = trend20d.get(categoryId);
      String trendPart =
          trend != null && trend.compareTo(BigDecimal.ZERO) > 0 ? ", 20d trend positive" : "";

      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_SCORE_APPROACHING_BUY,
              severity,
              String.format(
                  "%s approaching BUY threshold: score %d (need +%d pts for ≥65), RRG %s%s",
                  categoryId, scorePct, ptsNeeded, rrgLabel(rrgInt), trendPart),
              String.format(
                  "{\"score\":%d,\"ptsNeeded\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                  scorePct, ptsNeeded, rrgInt, signalDate),
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "score_approaching_buy: category={} score={} ptsNeeded={}",
          categoryId,
          scorePct,
          ptsNeeded);
    }
    return count;
  }

  private int evaluateApproachingReduce(AlertEvaluationContext context) {
    Optional<AlertRule> approachRule = alertRulesRepository.findById(RULE_SCORE_APPROACHING_REDUCE);
    if (!approachRule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = approachRule.map(AlertRule::severity).orElse(Severity.WARNING);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> prevComposite = previousComposite(signalDate);

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = composite.get(categoryId);
      if (score == null) continue;

      boolean inApproachZone =
          score.compareTo(REDUCE_SCORE_THRESHOLD) >= 0
              && score.compareTo(APPROACHING_REDUCE_UPPER) <= 0;
      if (!inApproachZone) continue;

      BigDecimal prevScore = prevComposite.get(categoryId);
      boolean wasAbove = prevScore == null || prevScore.compareTo(APPROACHING_REDUCE_UPPER) > 0;
      if (!wasAbove) continue;

      if (alertRepository.existsActiveAlert(RULE_SCORE_APPROACHING_REDUCE, categoryId)) continue;
      if (alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_REDUCE, categoryId)) continue;

      CategoryId catId = parseCategory(categoryId, "score_approaching_reduce");
      if (catId == null) continue;

      int scorePct = toPercent(score);
      int ptsBuffer = scorePct - toPercent(REDUCE_SCORE_THRESHOLD);
      int rrgInt = rrgQuadrant(rrgQuadrant, categoryId);

      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_SCORE_APPROACHING_REDUCE,
              severity,
              String.format(
                  "%s approaching REDUCE threshold: score %d (only %d pts above REDUCE zone ≤34), RRG %s — monitor for further deterioration",
                  categoryId, scorePct, ptsBuffer, rrgLabel(rrgInt)),
              String.format(
                  "{\"score\":%d,\"ptsBuffer\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                  scorePct, ptsBuffer, rrgInt, signalDate),
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "score_approaching_reduce: category={} score={} ptsBuffer={}",
          categoryId,
          scorePct,
          ptsBuffer);
    }
    return count;
  }

  private Map<String, BigDecimal> previousComposite(LocalDate signalDate) {
    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, signalDate);
    return prevDate != null
        ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, prevDate)
        : Map.of();
  }

  private CategoryId parseCategory(String categoryId, String ruleId) {
    try {
      return CategoryId.valueOf(categoryId);
    } catch (IllegalArgumentException e) {
      log.debug("{}: skipping unknown CategoryId={}", ruleId, categoryId);
      return null;
    }
  }

  private int toPercent(BigDecimal score) {
    return score.multiply(ONE_HUNDRED).intValue();
  }

  private int rrgQuadrant(Map<String, BigDecimal> rrgQuadrant, String categoryId) {
    BigDecimal rrg = rrgQuadrant.get(categoryId);
    return rrg != null ? rrg.intValue() : 0;
  }

  private String rrgLabel(int rrgQuadrant) {
    return switch (rrgQuadrant) {
      case 4 -> "Leading";
      case 3 -> "Improving";
      case 2 -> "Weakening";
      case 1 -> "Lagging";
      default -> "Unknown";
    };
  }
}

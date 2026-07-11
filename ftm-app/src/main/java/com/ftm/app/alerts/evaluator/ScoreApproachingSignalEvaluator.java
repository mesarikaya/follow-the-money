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
import java.util.List;
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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SCORE_APPROACHING_BUY);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> trend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    Map<String, BigDecimal> prevComposite = previousComposite(signalDate);
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    List<Approach> approaches =
        context.topLevelCategoryIds().stream()
            .map(categoryId -> assessBuy(categoryId, composite, prevComposite, rrgQuadrant, trend20d))
            .flatMap(Optional::stream)
            .filter(approach -> notSuppressed(approach, RULE_SCORE_APPROACHING_BUY, RULE_TRADE_SIGNAL_BUY))
            .toList();

    approaches.forEach(approach -> fireBuy(approach, severity, signalDate));
    return approaches.size();
  }

  private int evaluateApproachingReduce(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SCORE_APPROACHING_REDUCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> prevComposite = previousComposite(signalDate);
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    List<Approach> approaches =
        context.topLevelCategoryIds().stream()
            .map(categoryId -> assessReduce(categoryId, composite, prevComposite, rrgQuadrant))
            .flatMap(Optional::stream)
            .filter(
                approach ->
                    notSuppressed(approach, RULE_SCORE_APPROACHING_REDUCE, RULE_TRADE_SIGNAL_REDUCE))
            .toList();

    approaches.forEach(approach -> fireReduce(approach, severity, signalDate));
    return approaches.size();
  }

  private Optional<Approach> assessBuy(
      String categoryId,
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> prevComposite,
      Map<String, BigDecimal> rrgQuadrant,
      Map<String, BigDecimal> trend20d) {
    BigDecimal score = composite.get(categoryId);
    if (score == null) {
      return Optional.empty();
    }
    boolean inApproachZone =
        score.compareTo(APPROACHING_BUY_LOWER) >= 0 && score.compareTo(BUY_SCORE_THRESHOLD) < 0;
    BigDecimal prevScore = prevComposite.get(categoryId);
    boolean wasBelow = prevScore == null || prevScore.compareTo(APPROACHING_BUY_LOWER) < 0;
    if (!inApproachZone || !wasBelow) {
      return Optional.empty();
    }
    return knownCategory(categoryId, RULE_SCORE_APPROACHING_BUY)
        .map(
            category ->
                new Approach(
                    categoryId, category, score, quadrant(rrgQuadrant, categoryId), trend20d.get(categoryId)));
  }

  private Optional<Approach> assessReduce(
      String categoryId,
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> prevComposite,
      Map<String, BigDecimal> rrgQuadrant) {
    BigDecimal score = composite.get(categoryId);
    if (score == null) {
      return Optional.empty();
    }
    boolean inApproachZone =
        score.compareTo(REDUCE_SCORE_THRESHOLD) >= 0 && score.compareTo(APPROACHING_REDUCE_UPPER) <= 0;
    BigDecimal prevScore = prevComposite.get(categoryId);
    boolean wasAbove = prevScore == null || prevScore.compareTo(APPROACHING_REDUCE_UPPER) > 0;
    if (!inApproachZone || !wasAbove) {
      return Optional.empty();
    }
    return knownCategory(categoryId, RULE_SCORE_APPROACHING_REDUCE)
        .map(category -> new Approach(categoryId, category, score, quadrant(rrgQuadrant, categoryId), null));
  }

  /** Not already alerted, and not superseded by the formal trade signal in that direction. */
  private boolean notSuppressed(Approach approach, String approachRule, String tradeSignalRule) {
    return !alertRepository.existsActiveAlert(approachRule, approach.categoryId())
        && !alertRepository.existsActiveAlert(tradeSignalRule, approach.categoryId());
  }

  private void fireBuy(Approach approach, Severity severity, LocalDate signalDate) {
    int scorePct = toPercent(approach.score());
    int ptsNeeded = toPercent(BUY_SCORE_THRESHOLD) - scorePct;
    BigDecimal trend = approach.trend20d();
    String trendPart =
        trend != null && trend.compareTo(BigDecimal.ZERO) > 0 ? ", 20d trend positive" : "";
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            approach.category(),
            RULE_SCORE_APPROACHING_BUY,
            severity,
            String.format(
                "%s approaching BUY threshold: score %d (need +%d pts for ≥65), RRG %s%s",
                approach.categoryId(), scorePct, ptsNeeded, rrgLabel(approach.quadrant()), trendPart),
            String.format(
                "{\"score\":%d,\"ptsNeeded\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                scorePct, ptsNeeded, approach.quadrant(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "score_approaching_buy: category={} score={} ptsNeeded={}",
        approach.categoryId(),
        scorePct,
        ptsNeeded);
  }

  private void fireReduce(Approach approach, Severity severity, LocalDate signalDate) {
    int scorePct = toPercent(approach.score());
    int ptsBuffer = scorePct - toPercent(REDUCE_SCORE_THRESHOLD);
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            approach.category(),
            RULE_SCORE_APPROACHING_REDUCE,
            severity,
            String.format(
                "%s approaching REDUCE threshold: score %d (only %d pts above REDUCE zone ≤34), RRG %s — monitor for further deterioration",
                approach.categoryId(), scorePct, ptsBuffer, rrgLabel(approach.quadrant())),
            String.format(
                "{\"score\":%d,\"ptsBuffer\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                scorePct, ptsBuffer, approach.quadrant(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "score_approaching_reduce: category={} score={} ptsBuffer={}",
        approach.categoryId(),
        scorePct,
        ptsBuffer);
  }

  private Map<String, BigDecimal> previousComposite(LocalDate signalDate) {
    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, signalDate);
    return prevDate != null
        ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, prevDate)
        : Map.of();
  }

  private Optional<CategoryId> knownCategory(String categoryId, String ruleId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("{}: skipping unknown CategoryId={}", ruleId, categoryId);
      return Optional.empty();
    }
  }

  private int toPercent(BigDecimal value) {
    return value.multiply(ONE_HUNDRED).intValue();
  }

  private int quadrant(Map<String, BigDecimal> rrgQuadrant, String categoryId) {
    BigDecimal rrg = rrgQuadrant.get(categoryId);
    return rrg != null ? rrg.intValue() : 0;
  }

  private String rrgLabel(int quadrant) {
    return switch (quadrant) {
      case 4 -> "Leading";
      case 3 -> "Improving";
      case 2 -> "Weakening";
      case 1 -> "Lagging";
      default -> "Unknown";
    };
  }

  /** A sector entering an approach zone; {@code trend20d} is null for the REDUCE direction. */
  private record Approach(
      String categoryId, CategoryId category, BigDecimal score, int quadrant, BigDecimal trend20d) {}
}

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
 * Fires the formal BUY / REDUCE trade signals on the day a sector first meets all conditions (it did
 * not meet them on the previous signal date — a genuine transition, not a persisting state):
 *
 * <ul>
 *   <li><b>BUY</b> — composite ≥ 0.65, RRG Leading/Improving (3/4), and 20d trend positive.
 *   <li><b>REDUCE</b> — composite &lt; 0.35 and RRG Lagging/Weakening (1/2).
 * </ul>
 *
 * Resolution is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class TradeSignalTransitionsAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(TradeSignalTransitionsAlertEvaluator.class);

  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";
  private static final String RULE_TRADE_SIGNAL_REDUCE = "trade_signal_reduce";
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");
  private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public TradeSignalTransitionsAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> buyRule = alertRulesRepository.findById(RULE_TRADE_SIGNAL_BUY);
    Optional<AlertRule> reduceRule = alertRulesRepository.findById(RULE_TRADE_SIGNAL_REDUCE);
    boolean buyEnabled = buyRule.map(AlertRule::enabled).orElse(false);
    boolean reduceEnabled = reduceRule.map(AlertRule::enabled).orElse(false);
    if (!buyEnabled && !reduceEnabled) return 0;

    Severity buySeverity = buyRule.map(AlertRule::severity).orElse(Severity.ACTION);
    Severity reduceSeverity = reduceRule.map(AlertRule::severity).orElse(Severity.WARNING);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> trend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> prevComposite = mapForDate(SignalType.COMPOSITE, prevDate);
    Map<String, BigDecimal> prevRrg = mapForDate(SignalType.RRG_QUADRANT, prevDate);
    Map<String, BigDecimal> prevTrend = mapForDate(SignalType.COMPOSITE_TREND_20D, prevDate);

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = composite.get(categoryId);
      if (score == null) continue;
      BigDecimal rrg = rrgQuadrant.get(categoryId);
      BigDecimal trend = trend20d.get(categoryId);
      int rrgInt = rrg != null ? rrg.intValue() : 0;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        continue;
      }

      if (buyEnabled && isBuy(score, rrgInt, trend)) {
        boolean buyPrev =
            isBuy(
                prevComposite.get(categoryId),
                intValue(prevRrg.get(categoryId)),
                prevTrend.get(categoryId));
        if (!buyPrev && !alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId)) {
          int scorePct = score.multiply(ONE_HUNDRED).intValue();
          String rrgLabel = rrgInt == 4 ? "Leading" : "Improving";
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_TRADE_SIGNAL_BUY,
                  buySeverity,
                  String.format(
                      "%s full BUY signal triggered: score=%d, RRG=%s, 20d trend positive — all three conditions aligned",
                      categoryId, scorePct, rrgLabel),
                  String.format(
                      "{\"score\":%d,\"rrgQuadrant\":%d,\"trend20d\":%.4f,\"signalDate\":\"%s\"}",
                      scorePct, rrgInt, trend.doubleValue(), signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info("trade_signal_buy: category={} score={} rrg={}", categoryId, scorePct, rrgLabel);
        }
      }

      if (reduceEnabled && isReduce(score, rrgInt)) {
        boolean reducePrev =
            isReduce(prevComposite.get(categoryId), intValue(prevRrg.get(categoryId)));
        if (!reducePrev
            && !alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_REDUCE, categoryId)) {
          int scorePct = score.multiply(ONE_HUNDRED).intValue();
          String rrgLabel = rrgInt == 1 ? "Lagging" : "Weakening";
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_TRADE_SIGNAL_REDUCE,
                  reduceSeverity,
                  String.format(
                      "%s REDUCE signal: score=%d with %s RRG — consider trimming position",
                      categoryId, scorePct, rrgLabel),
                  String.format(
                      "{\"score\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                      scorePct, rrgInt, signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info(
              "trade_signal_reduce: category={} score={} rrg={}", categoryId, scorePct, rrgLabel);
        }
      }
    }
    return count;
  }

  private boolean isBuy(BigDecimal score, int rrgInt, BigDecimal trend) {
    return score != null
        && score.compareTo(BUY_SCORE_THRESHOLD) >= 0
        && (rrgInt == 3 || rrgInt == 4)
        && trend != null
        && trend.compareTo(BigDecimal.ZERO) > 0;
  }

  private boolean isReduce(BigDecimal score, int rrgInt) {
    return score != null
        && score.compareTo(REDUCE_SCORE_THRESHOLD) < 0
        && (rrgInt == 1 || rrgInt == 2);
  }

  private int intValue(BigDecimal value) {
    return value != null ? value.intValue() : 0;
  }

  private Map<String, BigDecimal> mapForDate(SignalType type, LocalDate date) {
    return date != null ? signalRepository.findByTypeAndDate(type, date) : Map.of();
  }
}

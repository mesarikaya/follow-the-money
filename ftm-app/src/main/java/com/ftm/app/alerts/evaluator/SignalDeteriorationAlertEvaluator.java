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
 * Fires per sector still in BUY territory (composite ≥ 0.65) whose 5-day trend has turned sharply
 * negative (≤ −0.05) — an early "momentum fading" heads-up before the formal signal exits BUY.
 */
@Component
public class SignalDeteriorationAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(SignalDeteriorationAlertEvaluator.class);

  private static final String RULE_SIGNAL_DETERIORATION = "signal_deterioration";
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal DETERIORATION_TREND_THRESHOLD = new BigDecimal("-0.05");

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public SignalDeteriorationAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SIGNAL_DETERIORATION);
    if (rule.isEmpty() || !rule.get().enabled()) return 0;
    Severity severity = rule.get().severity();

    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = composite.get(categoryId);
      BigDecimal trend = trend5d.get(categoryId);
      if (score == null || trend == null) continue;

      boolean inBuyTerritory = score.compareTo(BUY_SCORE_THRESHOLD) >= 0;
      boolean deteriorating = trend.compareTo(DETERIORATION_TREND_THRESHOLD) < 0;
      if (!inBuyTerritory || !deteriorating) continue;
      if (alertRepository.existsActiveAlert(RULE_SIGNAL_DETERIORATION, categoryId)) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        continue;
      }

      int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
      int trendPts = trend.multiply(BigDecimal.valueOf(100)).intValue();
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_SIGNAL_DETERIORATION,
              severity,
              String.format(
                  "%s BUY momentum deteriorating: score=%d still in BUY territory but 5d trend=%dpts — monitor for signal exit",
                  categoryId, scorePct, trendPts),
              String.format(
                  "{\"score\":%d,\"trend5d\":%.4f,\"signalDate\":\"%s\"}",
                  scorePct, trend.doubleValue(), signalDate),
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "signal_deterioration: category={} score={} trend5d={}pts", categoryId, scorePct, trendPts);
    }
    return count;
  }
}

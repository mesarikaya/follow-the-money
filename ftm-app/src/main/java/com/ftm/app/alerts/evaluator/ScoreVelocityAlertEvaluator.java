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
 * Fires per sector when its composite score moves ≥12 pts in five trading days — a SURGE (rapid
 * momentum acceleration) or a CRASH (rapid deterioration, an early warning before the formal REDUCE
 * signal). Resolves when the 5-day trend moderates back inside the ±5 pt normal range.
 */
@Component
public class ScoreVelocityAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ScoreVelocityAlertEvaluator.class);

  private static final String RULE_SCORE_VELOCITY = "score_velocity";
  private static final BigDecimal SCORE_VELOCITY_SURGE_THRESHOLD = new BigDecimal("0.12");
  private static final BigDecimal SCORE_VELOCITY_CRASH_THRESHOLD = new BigDecimal("-0.12");
  private static final BigDecimal SCORE_VELOCITY_SURGE_RESOLVE = new BigDecimal("0.05");
  private static final BigDecimal SCORE_VELOCITY_CRASH_RESOLVE = new BigDecimal("-0.05");

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ScoreVelocityAlertEvaluator(
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

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SCORE_VELOCITY);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> trend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> composites =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (trend5d.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal trend = trend5d.get(categoryId);
      BigDecimal composite = composites.get(categoryId);
      if (trend == null) continue;

      boolean isSurge = trend.compareTo(SCORE_VELOCITY_SURGE_THRESHOLD) >= 0;
      boolean isCrash = trend.compareTo(SCORE_VELOCITY_CRASH_THRESHOLD) <= 0;
      boolean hasActive = alertRepository.existsActiveAlert(RULE_SCORE_VELOCITY, categoryId);
      boolean isExtreme = isSurge || isCrash;
      boolean isNormal =
          trend.compareTo(SCORE_VELOCITY_SURGE_RESOLVE) < 0
              && trend.compareTo(SCORE_VELOCITY_CRASH_RESOLVE) > 0;

      if (isExtreme && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("score_velocity: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        int scorePts = composite != null ? Math.round(composite.floatValue() * 100) : -1;
        int trendPts = Math.abs(Math.round(trend.floatValue() * 100));
        String direction = isSurge ? "SURGE" : "CRASH";
        String message =
            isSurge
                ? String.format(
                    "%s score velocity SURGE: +%dpts in 5 days (now %d) — rapid momentum acceleration",
                    categoryId, trendPts, scorePts)
                : String.format(
                    "%s score velocity CRASH: -%dpts in 5 days (now %d) — rapid momentum deterioration",
                    categoryId, trendPts, scorePts);
        String snapshot =
            String.format(
                "{\"trend5d\":%.4f,\"composite\":%.4f,\"direction\":\"%s\",\"signalDate\":\"%s\"}",
                trend.doubleValue(),
                composite != null ? composite.doubleValue() : 0.0,
                direction,
                signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_SCORE_VELOCITY,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "score_velocity: category={} direction={} trend5d={} composite={}",
            categoryId,
            direction,
            trend,
            composite);
        count++;
      } else if (isNormal && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_SCORE_VELOCITY, categoryId);
        log.info(
            "score_velocity: resolved for category={} (trend5d={} returned to normal)",
            categoryId,
            trend);
      }
    }
    return count;
  }
}

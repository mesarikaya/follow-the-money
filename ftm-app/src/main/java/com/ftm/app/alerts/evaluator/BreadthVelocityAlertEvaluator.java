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
 * Fires per equity sector whose breadth is accelerating or decelerating: it compares the last-5-day
 * benchmark hit-rate against the prior-15-day baseline. When the recent rate jumps at least {@value
 * #BREADTH_VELOCITY_THRESHOLD_PP}pp above baseline it fires ACCEL; when it drops that far below it
 * fires DECEL. Resolution is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class BreadthVelocityAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(BreadthVelocityAlertEvaluator.class);

  private static final String RULE_BREADTH_VELOCITY_ACCEL = "breadth_velocity_accel";
  private static final String RULE_BREADTH_VELOCITY_DECEL = "breadth_velocity_decel";
  private static final int BREADTH_VELOCITY_THRESHOLD_PP = 10;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public BreadthVelocityAlertEvaluator(
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

    Optional<AlertRule> accelRule = alertRulesRepository.findById(RULE_BREADTH_VELOCITY_ACCEL);
    Optional<AlertRule> decelRule = alertRulesRepository.findById(RULE_BREADTH_VELOCITY_DECEL);

    boolean accelEnabled = accelRule.map(AlertRule::enabled).orElse(false);
    boolean decelEnabled = decelRule.map(AlertRule::enabled).orElse(false);
    if (!accelEnabled && !decelEnabled) return 0;

    Severity accelSeverity = accelRule.map(AlertRule::severity).orElse(Severity.INFO);
    Severity decelSeverity = decelRule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> persistence20d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    Map<String, BigDecimal> persistence5d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, signalDate);
    if (persistence20d.isEmpty() || persistence5d.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      BigDecimal p20 = persistence20d.get(categoryId);
      BigDecimal p5 = persistence5d.get(categoryId);
      if (p20 == null || p5 == null) continue;

      int velocityPp = velocityPercentagePoints(p5, p20);

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("breadth_velocity: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      if (accelEnabled && velocityPp >= BREADTH_VELOCITY_THRESHOLD_PP) {
        count +=
            fireIfAbsent(
                catId,
                categoryId,
                RULE_BREADTH_VELOCITY_ACCEL,
                accelSeverity,
                true,
                velocityPp,
                p5,
                p20,
                signalDate);
      }
      if (decelEnabled && velocityPp <= -BREADTH_VELOCITY_THRESHOLD_PP) {
        count +=
            fireIfAbsent(
                catId,
                categoryId,
                RULE_BREADTH_VELOCITY_DECEL,
                decelSeverity,
                false,
                velocityPp,
                p5,
                p20,
                signalDate);
      }
    }
    return count;
  }

  /** Recent-5d hit-rate minus prior-15d baseline hit-rate, expressed in percentage points. */
  private int velocityPercentagePoints(BigDecimal persistence5d, BigDecimal persistence20d) {
    double rate5d = persistence5d.doubleValue() / 5.0;
    double rate15 = (persistence20d.doubleValue() - persistence5d.doubleValue()) / 15.0;
    return (int) Math.round((rate5d - rate15) * 100);
  }

  private int fireIfAbsent(
      CategoryId catId,
      String categoryId,
      String ruleId,
      Severity severity,
      boolean accelerating,
      int velocityPp,
      BigDecimal p5,
      BigDecimal p20,
      LocalDate signalDate) {
    if (alertRepository.existsActiveAlert(ruleId, categoryId)) return 0;

    String direction = accelerating ? "above" : "below";
    String velocityLabel = accelerating ? "+" + velocityPp : String.valueOf(velocityPp);
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            catId,
            ruleId,
            severity,
            String.format(
                "%s breadth velocity %spp — recent-5d hit-rate sharply %s prior-15d baseline (P5=%d, P20=%d)",
                categoryId, velocityLabel, direction, p5.intValue(), p20.intValue()),
            String.format(
                "{\"velocityPp\":%d,\"persistence5d\":%d,\"persistence20d\":%d,\"signalDate\":\"%s\"}",
                velocityPp, p5.intValue(), p20.intValue(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "{}: category={} velocityPp={} p5d={} p20d={}",
        ruleId,
        categoryId,
        velocityPp,
        p5.intValue(),
        p20.intValue());
    return 1;
  }
}

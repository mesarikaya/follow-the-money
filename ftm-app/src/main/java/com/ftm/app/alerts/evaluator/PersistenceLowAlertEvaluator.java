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
 * Fires per equity sector whose 20-day persistence (the count of days it outperformed its
 * benchmark) has fallen below the rule's configured threshold — a "leadership fading" signal.
 * Resolution back to health is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class PersistenceLowAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(PersistenceLowAlertEvaluator.class);

  private static final String RULE_PERSISTENCE_LOW = "persistence_low";
  private static final int DEFAULT_PERSISTENCE_THRESHOLD = 7;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public PersistenceLowAlertEvaluator(
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

    Optional<AlertRule> persistenceRule = alertRulesRepository.findById(RULE_PERSISTENCE_LOW);
    if (!persistenceRule.map(AlertRule::enabled).orElse(false)) return 0;

    AlertRule rule = persistenceRule.get();
    int threshold =
        rule.persistenceDays() != null ? rule.persistenceDays() : DEFAULT_PERSISTENCE_THRESHOLD;
    Severity severity = rule.severity() != null ? rule.severity() : Severity.WARNING;

    Map<String, BigDecimal> persistenceSignals =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    if (persistenceSignals.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      BigDecimal persistence = persistenceSignals.get(categoryId);
      if (persistence == null || persistence.intValue() >= threshold) continue;
      if (alertRepository.existsActiveAlert(RULE_PERSISTENCE_LOW, categoryId)) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("persistence_low: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      int persistenceDays = persistence.intValue();
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_PERSISTENCE_LOW,
              severity,
              String.format(
                  "%s outperformed benchmark on only %d of the last 20 trading days — persistence below threshold (%d)",
                  categoryId, persistenceDays, threshold),
              String.format(
                  "{\"persistence20d\":%d,\"threshold\":%d,\"signalDate\":\"%s\"}",
                  persistenceDays, threshold, signalDate),
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "persistence_low alert: category={} persistence={}/20 threshold={}",
          categoryId,
          persistenceDays,
          threshold);
    }
    return count;
  }
}

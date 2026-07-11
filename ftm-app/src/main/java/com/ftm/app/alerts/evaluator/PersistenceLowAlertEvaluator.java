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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_PERSISTENCE_LOW);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    int threshold = persistenceThreshold(rule.get());
    Severity severity = severityOf(rule.get());
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> persistence =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);

    List<Breach> breaches =
        context.equityCategoryIds().stream()
            .map(categoryId -> assess(categoryId, persistence, threshold))
            .flatMap(Optional::stream)
            .filter(this::notAlreadyAlerted)
            .toList();

    breaches.forEach(breach -> fire(breach, severity, signalDate));
    return breaches.size();
  }

  /** A sector whose persistence has fallen below threshold, ready to alert on. */
  private record Breach(String categoryId, CategoryId category, int persistenceDays, int threshold) {}

  private Optional<Breach> assess(
      String categoryId, Map<String, BigDecimal> persistence, int threshold) {
    return Optional.ofNullable(persistence.get(categoryId))
        .filter(value -> value.intValue() < threshold)
        .flatMap(value -> knownCategory(categoryId).map(category -> breach(categoryId, category, value, threshold)));
  }

  private Breach breach(String categoryId, CategoryId category, BigDecimal value, int threshold) {
    return new Breach(categoryId, category, value.intValue(), threshold);
  }

  private boolean notAlreadyAlerted(Breach breach) {
    return !alertRepository.existsActiveAlert(RULE_PERSISTENCE_LOW, breach.categoryId());
  }

  private void fire(Breach breach, Severity severity, LocalDate signalDate) {
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            breach.category(),
            RULE_PERSISTENCE_LOW,
            severity,
            String.format(
                "%s outperformed benchmark on only %d of the last 20 trading days — persistence below threshold (%d)",
                breach.categoryId(), breach.persistenceDays(), breach.threshold()),
            String.format(
                "{\"persistence20d\":%d,\"threshold\":%d,\"signalDate\":\"%s\"}",
                breach.persistenceDays(), breach.threshold(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "persistence_low alert: category={} persistence={}/20 threshold={}",
        breach.categoryId(),
        breach.persistenceDays(),
        breach.threshold());
  }

  private int persistenceThreshold(AlertRule rule) {
    return rule.persistenceDays() != null ? rule.persistenceDays() : DEFAULT_PERSISTENCE_THRESHOLD;
  }

  private Severity severityOf(AlertRule rule) {
    return rule.severity() != null ? rule.severity() : Severity.WARNING;
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("persistence_low: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }
}

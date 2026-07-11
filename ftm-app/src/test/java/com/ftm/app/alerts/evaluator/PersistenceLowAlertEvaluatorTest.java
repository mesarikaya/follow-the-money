package com.ftm.app.alerts.evaluator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.instancio.Instancio;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PersistenceLowAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String RULE = "persistence_low";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private PersistenceLowAlertEvaluator evaluator() {
    return new PersistenceLowAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of("TECH"), Set.of("TECH"));
  }

  private AlertRule rule(boolean enabled, Integer persistenceDays) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), RULE)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.WARNING)
        .set(field(AlertRule::persistenceDays), persistenceDays)
        .create();
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false, 7)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesWhenPersistenceBelowThreshold() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true, 7)));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenPersistenceAtOrAboveThreshold() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true, 7)));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("7")));
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void usesDefaultThresholdWhenRuleThresholdNull() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true, null)));
    // Default threshold is 7; persistence 5 < 7 → fires
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("5")));
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void skipsWhenActiveAlertAlreadyExists() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true, 7)));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

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
class BreadthVelocityAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String ACCEL = "breadth_velocity_accel";
  private static final String DECEL = "breadth_velocity_decel";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private BreadthVelocityAlertEvaluator evaluator() {
    return new BreadthVelocityAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of("TECH"), Set.of("TECH"));
  }

  private AlertRule rule(String ruleId, boolean enabled, Severity severity) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), severity)
        .create();
  }

  private void stubPersistence(String p5, String p20) {
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(p20)));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(p5)));
  }

  @Test
  void createsNothingWhenBothRulesDisabled() {
    when(alertRulesRepository.findById(ACCEL))
        .thenReturn(Optional.of(rule(ACCEL, false, Severity.INFO)));
    when(alertRulesRepository.findById(DECEL))
        .thenReturn(Optional.of(rule(DECEL, false, Severity.WARNING)));

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesAccelWhenRecentRateFarAboveBaseline() {
    when(alertRulesRepository.findById(ACCEL))
        .thenReturn(Optional.of(rule(ACCEL, true, Severity.INFO)));
    when(alertRulesRepository.findById(DECEL))
        .thenReturn(Optional.of(rule(DECEL, false, Severity.WARNING)));
    // P5=5 → rate5d=1.0 (100%); prior-15d = (5-5)/15 = 0 → velocity = +100pp
    stubPersistence("5", "5");
    lenient().when(alertRepository.existsActiveAlert(ACCEL, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void firesDecelWhenRecentRateFarBelowBaseline() {
    when(alertRulesRepository.findById(ACCEL))
        .thenReturn(Optional.of(rule(ACCEL, false, Severity.INFO)));
    when(alertRulesRepository.findById(DECEL))
        .thenReturn(Optional.of(rule(DECEL, true, Severity.WARNING)));
    // P5=0 → rate5d=0; prior-15d = (15-0)/15 = 1.0 → velocity = -100pp
    stubPersistence("0", "15");
    lenient().when(alertRepository.existsActiveAlert(DECEL, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenVelocityWithinThreshold() {
    when(alertRulesRepository.findById(ACCEL))
        .thenReturn(Optional.of(rule(ACCEL, true, Severity.INFO)));
    when(alertRulesRepository.findById(DECEL))
        .thenReturn(Optional.of(rule(DECEL, true, Severity.WARNING)));
    // P5=3 → rate5d=0.6; prior-15d = (12-3)/15 = 0.6 → velocity = 0pp
    stubPersistence("3", "12");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void skipsAccelWhenActiveAlertAlreadyExists() {
    when(alertRulesRepository.findById(ACCEL))
        .thenReturn(Optional.of(rule(ACCEL, true, Severity.INFO)));
    when(alertRulesRepository.findById(DECEL))
        .thenReturn(Optional.of(rule(DECEL, false, Severity.WARNING)));
    stubPersistence("5", "5");
    when(alertRepository.existsActiveAlert(ACCEL, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

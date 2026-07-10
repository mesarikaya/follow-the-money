package com.ftm.app.alerts.evaluator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
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
class MacroRegimeShiftAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV = LocalDate.of(2024, 5, 31);
  private static final String RULE = "macro_regime_shift";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private MacroRegimeShiftAlertEvaluator evaluator() {
    return new MacroRegimeShiftAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of(), Set.of());
  }

  private AlertRule rule(boolean enabled) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), RULE)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.WARNING)
        .create();
  }

  @Test
  void disabledRuleCreatesNoAlert() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesWhenRegimeOrdinalChangesAndNoActiveAlert() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("x", new BigDecimal("2")));
    when(signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, DATE)).thenReturn(PREV);
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, PREV))
        .thenReturn(Map.of("x", new BigDecimal("1")));
    when(alertRepository.existsActiveAlert(RULE, null)).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenRegimeUnchanged() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("x", new BigDecimal("2")));
    when(signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, DATE)).thenReturn(PREV);
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, PREV))
        .thenReturn(Map.of("x", new BigDecimal("2")));

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void doesNotFireWhenNoPreviousSignalDate() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("x", new BigDecimal("2")));
    when(signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, DATE)).thenReturn(null);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

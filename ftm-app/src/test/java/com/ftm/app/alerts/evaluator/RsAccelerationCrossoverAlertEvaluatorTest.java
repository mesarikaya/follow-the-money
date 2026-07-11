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
class RsAccelerationCrossoverAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV = LocalDate.of(2024, 5, 31);
  private static final String RULE = "rs_accel_crossover";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private RsAccelerationCrossoverAlertEvaluator evaluator() {
    return new RsAccelerationCrossoverAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of("TECH"), Set.of("TECH"));
  }

  private AlertRule rule(boolean enabled) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), RULE)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.INFO)
        .create();
  }

  private void stub(String rs60, String rs120, String prevRs60, String prevRs120) {
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs60)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs120)));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(PREV);
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV))
        .thenReturn(Map.of("TECH", new BigDecimal(prevRs60)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV))
        .thenReturn(Map.of("TECH", new BigDecimal(prevRs120)));
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesOnBullishCrossover() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // now RS-60 (0.9) > RS-120 (0.5); prev RS-60 (0.3) < RS-120 (0.7) → crossed up
    stub("0.9", "0.5", "0.3", "0.7");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenNoCrossover() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // both days RS-60 > RS-120 → same side, no crossover
    stub("0.9", "0.5", "0.8", "0.6");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void doesNotFireWhenNoPreviousSignalDate() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.9")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.5")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(null);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

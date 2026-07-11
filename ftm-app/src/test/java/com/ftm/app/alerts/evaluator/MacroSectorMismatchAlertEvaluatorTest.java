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
class MacroSectorMismatchAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String RULE = "macro_sector_mismatch";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private MacroSectorMismatchAlertEvaluator evaluator() {
    return new MacroSectorMismatchAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  // TECH is a cyclical sector
  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of("TECH"), Set.of("TECH"));
  }

  private AlertRule rule(boolean enabled) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), RULE)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.WARNING)
        .create();
  }

  private void stub(String regimeOrdinal, String rrg) {
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("MARKET", new BigDecimal(regimeOrdinal)));
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rrg)));
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesWhenCyclicalLeadingInRiskOffRegime() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // regime ordinal 1 (RISK_OFF_FLIGHT) + TECH RRG 4 (Leading) → mismatch
    stub("1", "4");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenRegimeRiskOn() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // regime ordinal 2 (RISK_ON_GROWTH, not risk-off) + TECH Leading → no mismatch
    stub("2", "4");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void doesNotFireWhenSectorNotBullishQuadrant() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // risk-off but TECH RRG 2 (Weakening) → no mismatch
    stub("1", "2");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void resolvesWhenMismatchClearsAndAlertActive() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // risk-on now (no mismatch) but alert still active → resolve
    stub("2", "4");
    when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository).resolveAlertsByRuleAndCategory(RULE, "TECH");
    verify(alertRepository, never()).insert(any());
  }
}

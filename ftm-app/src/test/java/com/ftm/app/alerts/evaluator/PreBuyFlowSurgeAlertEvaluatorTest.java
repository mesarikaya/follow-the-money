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
class PreBuyFlowSurgeAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String RULE = "pre_buy_flow_surge";
  private static final String TRADE_BUY = "trade_signal_buy";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private PreBuyFlowSurgeAlertEvaluator evaluator() {
    return new PreBuyFlowSurgeAlertEvaluator(
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

  private void stub(String score, String flowZ) {
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(score)));
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(flowZ)));
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesWhenInApproachZoneAndFlowSurging() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // score 0.60 in [0.55, 0.65); flow z 2.0 >= 1.5
    stub("0.60", "2.0");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenFlowNotSurging() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    stub("0.60", "0.5");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void doesNotFireWhenScoreOutsideApproachZone() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // 0.70 already at/above BUY threshold → not in approach zone
    stub("0.70", "2.0");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void doesNotFireWhenFormalBuySignalActive() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    stub("0.60", "2.0");
    when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert(TRADE_BUY, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

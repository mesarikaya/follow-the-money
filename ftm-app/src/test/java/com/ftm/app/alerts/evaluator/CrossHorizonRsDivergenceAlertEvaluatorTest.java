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
class CrossHorizonRsDivergenceAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String RULE = "cross_horizon_rs_divergence";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private CrossHorizonRsDivergenceAlertEvaluator evaluator() {
    return new CrossHorizonRsDivergenceAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

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

  private void stub(String rs20, String rs60, String rs120) {
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs20)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs60)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs120)));
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesCounterTrendBounce() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // short-term bull (RS20 0.9 > RS60 0.5) but medium-term bear (RS60 0.5 < RS120 0.7)
    stub("0.9", "0.5", "0.7");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void firesPullbackInBull() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // short-term bear (RS20 0.4 < RS60 0.7) but medium-term bull (RS60 0.7 > RS120 0.5)
    stub("0.4", "0.7", "0.5");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenHorizonsAligned() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // all bullish and aligned: RS20 > RS60 > RS120
    stub("0.9", "0.7", "0.5");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void resolvesWhenAlignedAndAlertActive() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    stub("0.9", "0.7", "0.5"); // no divergence
    when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository).resolveAlertsByRuleAndCategory(RULE, "TECH");
    verify(alertRepository, never()).insert(any());
  }
}

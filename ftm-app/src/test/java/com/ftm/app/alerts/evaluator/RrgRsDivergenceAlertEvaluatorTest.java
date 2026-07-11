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
class RrgRsDivergenceAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String RULE = "rrg_rs_divergence";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private RrgRsDivergenceAlertEvaluator evaluator() {
    return new RrgRsDivergenceAlertEvaluator(
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

  private void stub(String rrg, String rs20, String rs60) {
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rrg)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs20)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rs60)));
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBearishDivergenceWhenRrgStrongButRsCracks() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // RRG 4 (Leading, bullish) but RS-20 (0.3) < RS-60 (0.7) → bearish divergence
    stub("4", "0.3", "0.7");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void firesBullishDivergenceWhenRrgWeakButRsRecovers() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // RRG 1 (Lagging, bearish) but RS-20 (0.7) > RS-60 (0.3) → bullish divergence
    stub("1", "0.7", "0.3");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenRrgAndRsAgree() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // RRG 4 (bullish) and RS-20 > RS-60 (bullish) → aligned, no divergence
    stub("4", "0.7", "0.3");
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void resolvesWhenDivergenceClosesAndAlertActive() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    // Aligned now (no divergence) but an alert is still active → resolve
    stub("4", "0.7", "0.3");
    when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository).resolveAlertsByRuleAndCategory(RULE, "TECH");
    verify(alertRepository, never()).insert(any());
  }
}

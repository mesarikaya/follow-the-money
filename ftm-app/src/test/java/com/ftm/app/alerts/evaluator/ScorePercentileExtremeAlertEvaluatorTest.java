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
import com.ftm.app.signals.repository.SignalAnalyticsRepository;
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
class ScorePercentileExtremeAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String RULE = "score_percentile_extreme";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock SignalAnalyticsRepository signalAnalyticsRepository;
  @Mock AlertRepository alertRepository;

  private ScorePercentileExtremeAlertEvaluator evaluator() {
    return new ScorePercentileExtremeAlertEvaluator(
        alertRulesRepository, signalRepository, signalAnalyticsRepository, alertRepository);
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

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesWhenPercentileAtHighExtreme() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(signalAnalyticsRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.95")));
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenPercentileNormal() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(signalAnalyticsRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.50")));
    lenient().when(alertRepository.existsActiveAlert(RULE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

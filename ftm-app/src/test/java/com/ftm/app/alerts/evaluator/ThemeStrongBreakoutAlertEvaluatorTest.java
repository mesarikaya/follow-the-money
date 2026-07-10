package com.ftm.app.alerts.evaluator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.instancio.Instancio;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ThemeStrongBreakoutAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PRIOR = LocalDate.of(2024, 5, 1);
  private static final String RULE = "theme_strong_breakout_confirmation";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock ThemeRepository themeRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private ThemeStrongBreakoutAlertEvaluator evaluator() {
    return new ThemeStrongBreakoutAlertEvaluator(
        alertRulesRepository, themeRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of(), Set.of());
  }

  private AlertRule rule(boolean enabled) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), RULE)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.ACTION)
        .create();
  }

  @Test
  void disabledRuleCreatesNothing() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesWhenScoreBrokeOutFromBelowBuy() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of("AI", List.of("A")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("A", new BigDecimal("0.75")));
    // the 20-step date walk resolves to PRIOR; prior score was below the BUY threshold.
    when(signalRepository.findPreviousSignalDate(eq(SignalType.COMPOSITE), any())).thenReturn(PRIOR);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PRIOR))
        .thenReturn(Map.of("A", new BigDecimal("0.55")));
    lenient().when(alertRepository.existsActiveAlertForTheme(RULE, "AI")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenPriorWasAlreadyAboveBuy() {
    when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(true)));
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of("AI", List.of("A")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("A", new BigDecimal("0.75")));
    when(signalRepository.findPreviousSignalDate(eq(SignalType.COMPOSITE), any())).thenReturn(PRIOR);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PRIOR))
        .thenReturn(Map.of("A", new BigDecimal("0.70")));
    lenient().when(alertRepository.existsActiveAlertForTheme(RULE, "AI")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

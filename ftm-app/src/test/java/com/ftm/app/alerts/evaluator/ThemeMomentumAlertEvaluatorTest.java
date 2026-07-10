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
class ThemeMomentumAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String SURGE = "theme_momentum_surge";
  private static final String COLLAPSE = "theme_momentum_collapse";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock ThemeRepository themeRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private ThemeMomentumAlertEvaluator evaluator() {
    return new ThemeMomentumAlertEvaluator(
        alertRulesRepository, themeRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of(), Set.of());
  }

  private AlertRule rule(String id, boolean enabled) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), id)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.ACTION)
        .create();
  }

  @Test
  void bothRulesDisabledCreatesNothing() {
    when(alertRulesRepository.findById(SURGE)).thenReturn(Optional.of(rule(SURGE, false)));
    when(alertRulesRepository.findById(COLLAPSE)).thenReturn(Optional.of(rule(COLLAPSE, false)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesSurgeWhenAvgTrendAboveThreshold() {
    when(alertRulesRepository.findById(SURGE)).thenReturn(Optional.of(rule(SURGE, true)));
    when(alertRulesRepository.findById(COLLAPSE)).thenReturn(Optional.of(rule(COLLAPSE, false)));
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of("AI", List.of("A", "B")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("A", new BigDecimal("0.02"), "B", new BigDecimal("0.02")));
    lenient().when(alertRepository.existsActiveAlertForTheme(SURGE, "AI")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenTrendIsFlat() {
    when(alertRulesRepository.findById(SURGE)).thenReturn(Optional.of(rule(SURGE, true)));
    when(alertRulesRepository.findById(COLLAPSE)).thenReturn(Optional.of(rule(COLLAPSE, true)));
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of("AI", List.of("A", "B")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("A", new BigDecimal("0.0"), "B", new BigDecimal("0.0")));
    lenient().when(alertRepository.existsActiveAlertForTheme(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

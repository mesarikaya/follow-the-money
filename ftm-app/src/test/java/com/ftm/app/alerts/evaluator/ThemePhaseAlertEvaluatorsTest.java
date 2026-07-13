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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * The three theme-phase rules share their scaffolding (constituents → averages → phase → compare
 * with a week ago), so they are tested together against the same fixtures.
 */
@ExtendWith(MockitoExtension.class)
class ThemePhaseAlertEvaluatorsTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 10);
  private static final LocalDate PRIOR_DATE = LocalDate.of(2024, 6, 3);
  private static final String THEME = "AI_INFRA";
  private static final String CATEGORY = "TECH";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock AlertRepository alertRepository;
  @Mock ThemeRepository themeRepository;
  @Mock SignalRepository signalRepository;

  private ThemeSignalReader reader() {
    return new ThemeSignalReader(themeRepository, signalRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of(), Set.of());
  }

  private AlertRule rule(String ruleId, boolean enabled) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), Severity.ACTION)
        .create();
  }

  private void stubTheme() {
    when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of(THEME, List.of(CATEGORY)));
  }

  /** Walks the signal history back to the date a week earlier. */
  private void stubPriorDateResolution() {
    when(signalRepository.findPreviousSignalDate(any(), any())).thenReturn(PRIOR_DATE);
  }

  private void stubSignal(SignalType type, LocalDate date, String value) {
    lenient()
        .when(signalRepository.findByTypeAndDate(type, date))
        .thenReturn(Map.of(CATEGORY, new BigDecimal(value)));
  }

  @Nested
  @DisplayName("theme_phase_breakout_entry")
  class BreakoutEntry {

    private static final String RULE = "theme_phase_breakout_entry";

    private ThemePhaseBreakoutEntryAlertEvaluator evaluator() {
      return new ThemePhaseBreakoutEntryAlertEvaluator(
          alertRulesRepository, alertRepository, reader());
    }

    @Test
    @DisplayName("a disabled rule creates nothing")
    void disabledRuleCreatesNothing() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, false)));

      assertThat(evaluator().evaluate(context())).isZero();

      verify(alertRepository, never()).insert(any());
    }

    @Test
    @DisplayName("fires when a theme newly enters BREAKOUT")
    void firesOnEntryIntoBreakout() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      // Score 0.70 with 5d pulling away from 20d → BREAKOUT.
      stubSignal(SignalType.COMPOSITE, DATE, "0.70");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.02");
      stubSignal(SignalType.COMPOSITE_TREND_20D, DATE, "0.001");
      stubPriorDateResolution();
      // A week ago it was merely BUILDING.
      stubSignal(SignalType.COMPOSITE, PRIOR_DATE, "0.55");
      stubSignal(SignalType.COMPOSITE_TREND_5D, PRIOR_DATE, "0.0");
      stubSignal(SignalType.COMPOSITE_TREND_20D, PRIOR_DATE, "0.0");

      assertThat(evaluator().evaluate(context())).isEqualTo(1);

      verify(alertRepository).insert(any(Alert.class));
    }

    @Test
    @DisplayName("stays quiet when the theme was already in BREAKOUT a week ago")
    void quietWhenAlreadyBreakingOut() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      stubSignal(SignalType.COMPOSITE, DATE, "0.70");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.02");
      stubSignal(SignalType.COMPOSITE_TREND_20D, DATE, "0.001");
      stubPriorDateResolution();
      stubSignal(SignalType.COMPOSITE, PRIOR_DATE, "0.70");
      stubSignal(SignalType.COMPOSITE_TREND_5D, PRIOR_DATE, "0.02");
      stubSignal(SignalType.COMPOSITE_TREND_20D, PRIOR_DATE, "0.001");

      assertThat(evaluator().evaluate(context())).isZero();

      verify(alertRepository, never()).insert(any());
    }

    @Test
    @DisplayName("resolves an active alert once the theme leaves BREAKOUT and MOMENTUM")
    void resolvesWhenPhaseCools() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      // Score 0.40, flat trends → BUILDING: neither BREAKOUT nor MOMENTUM.
      stubSignal(SignalType.COMPOSITE, DATE, "0.40");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.0");
      stubSignal(SignalType.COMPOSITE_TREND_20D, DATE, "0.0");
      when(alertRepository.existsActiveAlertForTheme(RULE, THEME)).thenReturn(true);

      assertThat(evaluator().evaluate(context())).isZero();

      verify(alertRepository).resolveAlertsByRuleAndTheme(RULE, THEME);
    }
  }

  @Nested
  @DisplayName("theme_phase_fading")
  class Fading {

    private static final String RULE = "theme_phase_fading";

    private ThemePhaseFadingAlertEvaluator evaluator() {
      return new ThemePhaseFadingAlertEvaluator(alertRulesRepository, alertRepository, reader());
    }

    @Test
    @DisplayName("fires when a theme newly starts fading")
    void firesOnEntryIntoFading() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      // Score 0.52, 20d negative and 5d not pulling away from it → FADING (not SETUP).
      stubSignal(SignalType.COMPOSITE, DATE, "0.52");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "-0.02");
      stubSignal(SignalType.COMPOSITE_TREND_20D, DATE, "-0.01");
      stubPriorDateResolution();
      stubSignal(SignalType.COMPOSITE, PRIOR_DATE, "0.55");
      stubSignal(SignalType.COMPOSITE_TREND_5D, PRIOR_DATE, "0.0");
      stubSignal(SignalType.COMPOSITE_TREND_20D, PRIOR_DATE, "0.0");

      assertThat(evaluator().evaluate(context())).isEqualTo(1);

      verify(alertRepository).insert(any(Alert.class));
    }

    @Test
    @DisplayName("resolves once the theme stops fading")
    void resolvesWhenNoLongerFading() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      stubSignal(SignalType.COMPOSITE, DATE, "0.60");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.0");
      stubSignal(SignalType.COMPOSITE_TREND_20D, DATE, "0.0");
      when(alertRepository.existsActiveAlertForTheme(RULE, THEME)).thenReturn(true);

      assertThat(evaluator().evaluate(context())).isZero();

      verify(alertRepository).resolveAlertsByRuleAndTheme(RULE, THEME);
    }
  }

  @Nested
  @DisplayName("theme_recovery_signal")
  class Recovery {

    private static final String RULE = "theme_recovery_signal";

    private ThemeRecoverySignalAlertEvaluator evaluator() {
      return new ThemeRecoverySignalAlertEvaluator(alertRulesRepository, alertRepository, reader());
    }

    @Test
    @DisplayName("fires when a beaten-down theme turns up and its 20d trend was negative a week ago")
    void firesOnEarlyTurn() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      stubSignal(SignalType.COMPOSITE, DATE, "0.45");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.01");
      stubPriorDateResolution();
      stubSignal(SignalType.COMPOSITE_TREND_20D, PRIOR_DATE, "-0.01");

      assertThat(evaluator().evaluate(context())).isEqualTo(1);

      verify(alertRepository).insert(any(Alert.class));
    }

    @Test
    @DisplayName("stays quiet when the 20d trend was already positive a week ago")
    void quietWhenPriorTrendWasPositive() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      stubSignal(SignalType.COMPOSITE, DATE, "0.45");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.01");
      stubPriorDateResolution();
      stubSignal(SignalType.COMPOSITE_TREND_20D, PRIOR_DATE, "0.01");

      assertThat(evaluator().evaluate(context())).isZero();

      verify(alertRepository, never()).insert(any());
    }

    @Test
    @DisplayName("resolves once the recovery is confirmed")
    void resolvesWhenRecoveryConfirmed() {
      when(alertRulesRepository.findById(RULE)).thenReturn(Optional.of(rule(RULE, true)));
      stubTheme();
      stubSignal(SignalType.COMPOSITE, DATE, "0.70");
      stubSignal(SignalType.COMPOSITE_TREND_5D, DATE, "0.01");
      when(alertRepository.existsActiveAlertForTheme(RULE, THEME)).thenReturn(true);

      assertThat(evaluator().evaluate(context())).isZero();

      verify(alertRepository).resolveAlertsByRuleAndTheme(RULE, THEME);
    }
  }
}

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
class ScoreApproachingSignalEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV = LocalDate.of(2024, 5, 31);
  private static final String BUY = "score_approaching_buy";
  private static final String REDUCE = "score_approaching_reduce";
  private static final String TRADE_BUY = "trade_signal_buy";
  private static final String TRADE_REDUCE = "trade_signal_reduce";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private ScoreApproachingSignalEvaluator evaluator() {
    return new ScoreApproachingSignalEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  private AlertEvaluationContext context() {
    return new AlertEvaluationContext(DATE, Set.of("TECH"), Set.of("TECH"));
  }

  private AlertRule rule(String ruleId, boolean enabled, Severity severity) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), severity)
        .create();
  }

  private void disableBoth() {
    lenient()
        .when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, false, Severity.INFO)));
    lenient()
        .when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
  }

  private void stubComposite(String today, String yesterday) {
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(today)));
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.02")));
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(PREV);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PREV))
        .thenReturn(Map.of("TECH", new BigDecimal(yesterday)));
  }

  @Test
  void createsNothingWhenBothRulesDisabled() {
    disableBoth();
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBuyApproachOnTransitionIntoZone() {
    when(alertRulesRepository.findById(BUY)).thenReturn(Optional.of(rule(BUY, true, Severity.INFO)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
    // Today 0.60 in [0.55, 0.65); yesterday 0.50 below 0.55 → transition
    stubComposite("0.60", "0.50");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireBuyWhenAlreadyInZoneYesterday() {
    when(alertRulesRepository.findById(BUY)).thenReturn(Optional.of(rule(BUY, true, Severity.INFO)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
    // Yesterday 0.58 already in-zone → not a transition
    stubComposite("0.60", "0.58");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void doesNotFireBuyWhenFormalTradeSignalActive() {
    when(alertRulesRepository.findById(BUY)).thenReturn(Optional.of(rule(BUY, true, Severity.INFO)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
    stubComposite("0.60", "0.50");
    when(alertRepository.existsActiveAlert(BUY, "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert(TRADE_BUY, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesReduceApproachOnTransitionIntoZone() {
    when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, false, Severity.INFO)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, true, Severity.WARNING)));
    // Today 0.40 in [0.35, 0.45]; yesterday 0.50 above 0.45 → transition down
    stubComposite("0.40", "0.50");
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireReduceWhenFormalTradeSignalActive() {
    when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, false, Severity.INFO)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, true, Severity.WARNING)));
    stubComposite("0.40", "0.50");
    when(alertRepository.existsActiveAlert(REDUCE, "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert(TRADE_REDUCE, "TECH")).thenReturn(true);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

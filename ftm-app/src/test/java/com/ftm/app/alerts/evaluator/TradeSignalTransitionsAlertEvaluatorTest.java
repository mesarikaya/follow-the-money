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
class TradeSignalTransitionsAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV = LocalDate.of(2024, 5, 31);
  private static final String BUY = "trade_signal_buy";
  private static final String REDUCE = "trade_signal_reduce";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private TradeSignalTransitionsAlertEvaluator evaluator() {
    return new TradeSignalTransitionsAlertEvaluator(
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

  private void stubToday(String score, String rrg, String trend) {
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(score)));
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(rrg)));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal(trend)));
  }

  private void stubPrev(String score, String rrg, String trend) {
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(PREV);
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PREV))
        .thenReturn(Map.of("TECH", new BigDecimal(score)));
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, PREV))
        .thenReturn(Map.of("TECH", new BigDecimal(rrg)));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, PREV))
        .thenReturn(Map.of("TECH", new BigDecimal(trend)));
  }

  @Test
  void createsNothingWhenBothRulesDisabled() {
    when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, false, Severity.ACTION)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBuyOnTransitionIntoBuyState() {
    when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, true, Severity.ACTION)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
    // Today qualifies for BUY: score .70, RRG 4, +trend
    stubToday("0.70", "4", "0.05");
    // Yesterday did NOT qualify (score below BUY threshold)
    stubPrev("0.50", "4", "0.05");
    lenient().when(alertRepository.existsActiveAlert(BUY, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireBuyWhenAlreadyBuyYesterday() {
    when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, true, Severity.ACTION)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, false, Severity.WARNING)));
    stubToday("0.70", "4", "0.05");
    stubPrev("0.70", "4", "0.05"); // already BUY yesterday → not a transition
    lenient().when(alertRepository.existsActiveAlert(BUY, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesReduceOnTransitionIntoReduceState() {
    when(alertRulesRepository.findById(BUY))
        .thenReturn(Optional.of(rule(BUY, false, Severity.ACTION)));
    when(alertRulesRepository.findById(REDUCE))
        .thenReturn(Optional.of(rule(REDUCE, true, Severity.WARNING)));
    // Today qualifies for REDUCE: score .30 (<0.35), RRG 1
    stubToday("0.30", "1", "-0.05");
    stubPrev("0.50", "3", "0.02"); // yesterday not REDUCE
    lenient().when(alertRepository.existsActiveAlert(REDUCE, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }
}

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
class RsAlignedAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV = LocalDate.of(2024, 5, 31);
  private static final String BULL = "rs_aligned_bull";
  private static final String BEAR = "rs_aligned_bear";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private RsAlignedAlertEvaluator evaluator() {
    return new RsAlignedAlertEvaluator(alertRulesRepository, signalRepository, alertRepository);
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

  private void stubHorizons(LocalDate date, String rs20, String rs60, String rs120) {
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, date))
        .thenReturn(Map.of("TECH", new BigDecimal(rs20)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, date))
        .thenReturn(Map.of("TECH", new BigDecimal(rs60)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, date))
        .thenReturn(Map.of("TECH", new BigDecimal(rs120)));
  }

  @Test
  void createsNothingWhenBothRulesDisabled() {
    when(alertRulesRepository.findById(BULL))
        .thenReturn(Optional.of(rule(BULL, false, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, false, Severity.WARNING)));

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBullOnFirstDayOfBullishAlignment() {
    when(alertRulesRepository.findById(BULL))
        .thenReturn(Optional.of(rule(BULL, true, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, false, Severity.WARNING)));
    // Today aligned bull: 0.9 > 0.6 > 0.3
    stubHorizons(DATE, "0.9", "0.6", "0.3");
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV);
    // Yesterday NOT aligned: 0.3 < 0.6
    stubHorizons(PREV, "0.3", "0.6", "0.9");
    lenient().when(alertRepository.existsActiveAlert(BULL, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireBullWhenAlreadyAlignedYesterday() {
    when(alertRulesRepository.findById(BULL))
        .thenReturn(Optional.of(rule(BULL, true, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, false, Severity.WARNING)));
    stubHorizons(DATE, "0.9", "0.6", "0.3");
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV);
    // Yesterday ALSO aligned → not a transition
    stubHorizons(PREV, "0.9", "0.6", "0.3");
    lenient().when(alertRepository.existsActiveAlert(BULL, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBearOnFirstDayOfBearishAlignment() {
    when(alertRulesRepository.findById(BULL))
        .thenReturn(Optional.of(rule(BULL, false, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, true, Severity.WARNING)));
    // Today aligned bear: 0.3 < 0.6 < 0.9
    stubHorizons(DATE, "0.3", "0.6", "0.9");
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV);
    // Yesterday NOT bear-aligned
    stubHorizons(PREV, "0.9", "0.6", "0.3");
    lenient().when(alertRepository.existsActiveAlert(BEAR, "TECH")).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenNotAligned() {
    when(alertRulesRepository.findById(BULL))
        .thenReturn(Optional.of(rule(BULL, true, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, true, Severity.WARNING)));
    // Neither bull nor bear aligned: 0.6, 0.9, 0.3 → rs20<rs60 but rs60>rs120
    stubHorizons(DATE, "0.6", "0.9", "0.3");
    lenient()
        .when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE))
        .thenReturn(PREV);
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

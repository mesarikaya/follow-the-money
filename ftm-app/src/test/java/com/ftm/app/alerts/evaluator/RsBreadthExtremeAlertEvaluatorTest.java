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
class RsBreadthExtremeAlertEvaluatorTest {

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final String BULL = "rs_breadth_bull";
  private static final String BEAR = "rs_breadth_bear";

  @Mock AlertRulesRepository alertRulesRepository;
  @Mock SignalRepository signalRepository;
  @Mock AlertRepository alertRepository;

  private RsBreadthExtremeAlertEvaluator evaluator() {
    return new RsBreadthExtremeAlertEvaluator(
        alertRulesRepository, signalRepository, alertRepository);
  }

  /** Five equity sectors — enough to make 60% / 45% fractions meaningful. */
  private AlertEvaluationContext context() {
    Set<String> sectors = Set.of("TECH", "ENRG", "FINL", "HLTH", "INDU");
    return new AlertEvaluationContext(DATE, sectors, sectors);
  }

  private AlertRule rule(String ruleId, boolean enabled, Severity severity) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), enabled)
        .set(field(AlertRule::severity), severity)
        .create();
  }

  private Map<String, BigDecimal> rsMap(BigDecimal tech, BigDecimal others) {
    return Map.of(
        "TECH", tech, "ENRG", others, "FINL", others, "HLTH", others, "INDU", others);
  }

  @Test
  void createsNothingWhenBothRulesDisabled() {
    when(alertRulesRepository.findById(BULL)).thenReturn(Optional.of(rule(BULL, false, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, false, Severity.WARNING)));

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void firesBullWhenMajorityHaveRs20AboveRs60() {
    when(alertRulesRepository.findById(BULL)).thenReturn(Optional.of(rule(BULL, true, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, false, Severity.WARNING)));
    // All five sectors: RS_20 (0.9) > RS_60 (0.5) → 100% bull fraction
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(rsMap(new BigDecimal("0.9"), new BigDecimal("0.9")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(rsMap(new BigDecimal("0.5"), new BigDecimal("0.5")));
    lenient().when(alertRepository.existsActiveAlert(BULL, null)).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void firesBearWhenMajorityHaveRs20BelowRs60() {
    when(alertRulesRepository.findById(BULL)).thenReturn(Optional.of(rule(BULL, false, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, true, Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(rsMap(new BigDecimal("0.3"), new BigDecimal("0.3")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(rsMap(new BigDecimal("0.7"), new BigDecimal("0.7")));
    lenient().when(alertRepository.existsActiveAlert(BEAR, null)).thenReturn(false);

    assertThat(evaluator().evaluate(context())).isEqualTo(1);
    verify(alertRepository).insert(any(Alert.class));
  }

  @Test
  void doesNotFireWhenBreadthBelowFireThreshold() {
    when(alertRulesRepository.findById(BULL)).thenReturn(Optional.of(rule(BULL, true, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, true, Severity.WARNING)));
    // Only TECH bull, four others bear → 20% bull, 80% bear... make it balanced instead:
    // TECH & ENRG bull (0.9>0.5), FINL/HLTH/INDU neutral-ish bear (0.4<0.5) → 40% bull, 60% bear
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("0.9"),
                "ENRG", new BigDecimal("0.9"),
                "FINL", new BigDecimal("0.5"),
                "HLTH", new BigDecimal("0.5"),
                "INDU", new BigDecimal("0.5")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("0.5"),
                "ENRG", new BigDecimal("0.5"),
                "FINL", new BigDecimal("0.5"),
                "HLTH", new BigDecimal("0.5"),
                "INDU", new BigDecimal("0.5")));
    lenient().when(alertRepository.existsActiveAlert(any(), any())).thenReturn(false);

    // 40% bull (< 60% fire), 0% bear → neither fires
    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }

  @Test
  void createsNothingWhenSignalsMissing() {
    when(alertRulesRepository.findById(BULL)).thenReturn(Optional.of(rule(BULL, true, Severity.INFO)));
    when(alertRulesRepository.findById(BEAR))
        .thenReturn(Optional.of(rule(BEAR, true, Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE)).thenReturn(Map.of());
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE)).thenReturn(Map.of());

    assertThat(evaluator().evaluate(context())).isZero();
    verify(alertRepository, never()).insert(any());
  }
}

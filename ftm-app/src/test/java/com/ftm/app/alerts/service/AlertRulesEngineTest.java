package com.ftm.app.alerts.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AlertRulesEngineTest {

  @Mock AlertRepository alertRepository;
  @Mock AlertRulesRepository alertRulesRepository;
  @Mock RotationEventRepository rotationEventRepository;
  @Mock SignalRepository signalRepository;
  @Mock CategoryRepository categoryRepository;

  AlertRulesEngine engine;

  private static final LocalDate DATE = LocalDate.of(2024, 6, 1);
  private static final LocalDate PREV_DATE = LocalDate.of(2024, 5, 31);

  @BeforeEach
  void setUp() {
    engine =
        new AlertRulesEngine(
            alertRepository,
            alertRulesRepository,
            rotationEventRepository,
            signalRepository,
            categoryRepository);
  }

  private AlertRule enabled(String ruleId, Severity severity) {
    return new AlertRule(ruleId, true, null, null, null, severity, null, null, null);
  }

  private AlertRule disabled(String ruleId) {
    return new AlertRule(ruleId, false, null, null, null, Severity.INFO, null, null, null);
  }

  private void stubTopLevelCategories(String... ids) {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of(ids));
  }

  private void stubMacroDisabled() {
    when(alertRulesRepository.findById("macro_regime_shift"))
        .thenReturn(Optional.of(disabled("macro_regime_shift")));
  }

  private void stubRsAccelDisabled() {
    when(alertRulesRepository.findById("rs_accel_crossover"))
        .thenReturn(Optional.of(disabled("rs_accel_crossover")));
  }

  private void stubRrgAndBreakoutDisabled() {
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
  }

  // ===== RRG Transition Tests =====

  @Test
  @DisplayName("rrg_transition enabled: inserts alert for ENTERING_IMPROVING event")
  void shouldCreateRrgAlertForEnteringImprovingEvent() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event =
        new RotationEvent(
            DATE,
            CategoryId.TECH,
            RotationEventType.ENTERING_IMPROVING,
            new BigDecimal("0.800"),
            "{}",
            "");

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(enabled("rrg_transition", Severity.INFO)));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    when(alertRepository.existsActiveAlert("rrg_transition", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("rrg_transition");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.INFO);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("TECH").contains("Improving");
  }

  @Test
  @DisplayName("rrg_transition enabled: inserts alert for ENTERING_LEADING event")
  void shouldCreateRrgAlertForEnteringLeadingEvent() {
    stubTopLevelCategories("FINL");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event =
        new RotationEvent(
            DATE,
            CategoryId.FINL,
            RotationEventType.ENTERING_LEADING,
            new BigDecimal("0.900"),
            "{}",
            "");

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(enabled("rrg_transition", Severity.ACTION)));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    when(alertRepository.existsActiveAlert("rrg_transition", "FINL")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    assertThat(captor.getValue().message()).contains("FINL").contains("Leading");
  }

  @Test
  @DisplayName("rrg_transition disabled: no alert inserted")
  void shouldNotCreateRrgAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event =
        new RotationEvent(
            DATE,
            CategoryId.TECH,
            RotationEventType.ENTERING_IMPROVING,
            new BigDecimal("0.800"),
            "{}",
            "");

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rrg_transition enabled: no duplicate when active alert already exists")
  void shouldNotCreateRrgAlertWhenActiveAlertAlreadyExists() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event =
        new RotationEvent(
            DATE,
            CategoryId.TECH,
            RotationEventType.ENTERING_IMPROVING,
            new BigDecimal("0.800"),
            "{}",
            "");

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(enabled("rrg_transition", Severity.INFO)));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    when(alertRepository.existsActiveAlert("rrg_transition", "TECH")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  // ===== Composite Breakout Tests =====

  @Test
  @DisplayName("composite_breakout enabled: inserts alert for COMPOSITE_BREAKOUT event")
  void shouldCreateBreakoutAlertForCompositeBreakoutEvent() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event =
        new RotationEvent(
            DATE,
            CategoryId.TECH,
            RotationEventType.COMPOSITE_BREAKOUT,
            new BigDecimal("0.750"),
            "{}",
            "");

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(enabled("composite_breakout", Severity.ACTION)));
    when(alertRepository.existsActiveAlert("composite_breakout", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("composite_breakout");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.ACTION);
    assertThat(inserted.message()).contains("TECH").contains("composite").contains("breakout");
  }

  // ===== Macro Regime Shift Tests =====

  @Test
  @DisplayName("macro_regime_shift enabled: inserts alert when regime ordinal changes")
  void shouldCreateMacroAlertWhenRegimeChanges() {
    stubTopLevelCategories("TECH");
    stubRrgAndBreakoutDisabled();
    stubRsAccelDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("macro_regime_shift"))
        .thenReturn(Optional.of(enabled("macro_regime_shift", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("GLOBAL", new BigDecimal("2"))); // RISK_ON_GROWTH
    when(signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, PREV_DATE))
        .thenReturn(Map.of("GLOBAL", new BigDecimal("0"))); // STAGFLATION
    when(alertRepository.existsActiveAlert("macro_regime_shift", null)).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("macro_regime_shift");
    assertThat(inserted.categoryId()).isNull();
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.message()).contains("STAGFLATION").contains("RISK_ON_GROWTH");
  }

  @Test
  @DisplayName("macro_regime_shift: no alert when regime ordinal is unchanged")
  void shouldNotCreateMacroAlertWhenRegimeUnchanged() {
    stubTopLevelCategories("TECH");
    stubRrgAndBreakoutDisabled();
    stubRsAccelDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("macro_regime_shift"))
        .thenReturn(Optional.of(enabled("macro_regime_shift", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("GLOBAL", new BigDecimal("2")));
    when(signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, PREV_DATE))
        .thenReturn(Map.of("GLOBAL", new BigDecimal("2"))); // Same regime

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("macro_regime_shift: no alert when no previous signal date exists")
  void shouldNotCreateMacroAlertWhenNoPreviousSignalDate() {
    stubTopLevelCategories("TECH");
    stubRrgAndBreakoutDisabled();
    stubRsAccelDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("macro_regime_shift"))
        .thenReturn(Optional.of(enabled("macro_regime_shift", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("GLOBAL", new BigDecimal("2")));
    when(signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, DATE)).thenReturn(null);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  // ===== RS Acceleration Crossover Tests =====

  @Test
  @DisplayName("rs_accel_crossover enabled: inserts bullish alert when RS-60 crosses above RS-120")
  void shouldCreateBullishCrossoverAlert() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRrgAndBreakoutDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("rs_accel_crossover"))
        .thenReturn(Optional.of(enabled("rs_accel_crossover", Severity.INFO)));

    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.050")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.020")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.010"))); // was below
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.030"))); // RS-60 was below RS-120
    when(alertRepository.existsActiveAlert("rs_accel_crossover", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("rs_accel_crossover");
    assertThat(inserted.message()).contains("TECH").contains("above").contains("accelerating");
  }

  @Test
  @DisplayName("rs_accel_crossover enabled: inserts bearish alert when RS-60 crosses below RS-120")
  void shouldCreateBearishCrossoverAlert() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRrgAndBreakoutDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("rs_accel_crossover"))
        .thenReturn(Optional.of(enabled("rs_accel_crossover", Severity.INFO)));

    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.010"))); // now below
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.030")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.050"))); // was above
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.020")));
    when(alertRepository.existsActiveAlert("rs_accel_crossover", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.message()).contains("TECH").contains("below").contains("decelerating");
  }

  @Test
  @DisplayName("rs_accel_crossover: no alert when RS relationship is unchanged (both above)")
  void shouldNotCreateCrossoverAlertWhenRelationshipUnchanged() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRrgAndBreakoutDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("rs_accel_crossover"))
        .thenReturn(Optional.of(enabled("rs_accel_crossover", Severity.INFO)));

    // RS-60 was above RS-120 and still is — no crossover
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.060")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.020")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.050"))); // also above
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.020")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rs_accel_crossover: skips non-top-level category IDs")
  void shouldSkipSubSectorCategoriesForRsAccelCrossover() {
    // SEMI is a sub-sector (has parent TECH), not top-level
    stubTopLevelCategories("TECH"); // SEMI not included
    stubMacroDisabled();
    stubRrgAndBreakoutDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("rs_accel_crossover"))
        .thenReturn(Optional.of(enabled("rs_accel_crossover", Severity.INFO)));

    // RS-60 signals include SEMI (sub-sector) but not TECH
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("SEMI", new BigDecimal("1.050")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("SEMI", new BigDecimal("1.020")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE))
        .thenReturn(Map.of("SEMI", new BigDecimal("1.010")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE))
        .thenReturn(Map.of("SEMI", new BigDecimal("1.030")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    // SEMI should be skipped because it's not in topLevelCategoryIds
    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rs_accel_crossover: no alert when no previous signal date exists")
  void shouldNotCreateCrossoverAlertWhenNoPreviousDate() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRrgAndBreakoutDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("rs_accel_crossover"))
        .thenReturn(Optional.of(enabled("rs_accel_crossover", Severity.INFO)));

    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.050")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("1.020")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_60, DATE)).thenReturn(null);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }
}

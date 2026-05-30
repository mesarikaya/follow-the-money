package com.ftm.app.alerts.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
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
import org.instancio.Instancio;
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
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), true)
        .set(field(AlertRule::severity), severity)
        .create();
  }

  private AlertRule disabled(String ruleId) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), false)
        .create();
  }

  private RotationEvent rotationEvent(CategoryId categoryId, RotationEventType eventType) {
    return Instancio.of(RotationEvent.class)
        .set(field(RotationEvent::categoryId), categoryId)
        .set(field(RotationEvent::eventType), eventType)
        .create();
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

  private void stubBreakdownDisabled() {
    when(alertRulesRepository.findById("composite_breakdown"))
        .thenReturn(Optional.of(disabled("composite_breakdown")));
  }

  private void stubRrgAndBreakoutAndBreakdownDisabled() {
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    stubBreakdownDisabled();
  }

  private void stubPersistenceLowDisabled() {
    when(alertRulesRepository.findById("persistence_low"))
        .thenReturn(Optional.of(disabled("persistence_low")));
  }

  private AlertRule enabledWithPersistenceDays(String ruleId, Severity severity, int days) {
    return Instancio.of(AlertRule.class)
        .set(field(AlertRule::ruleId), ruleId)
        .set(field(AlertRule::enabled), true)
        .set(field(AlertRule::severity), severity)
        .set(field(AlertRule::persistenceDays), days)
        .create();
  }

  // ===== RRG Transition Tests =====

  @Test
  @DisplayName("rrg_transition enabled: inserts alert for ENTERING_IMPROVING event")
  void shouldCreateRrgAlertForEnteringImprovingEvent() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event = rotationEvent(CategoryId.TECH, RotationEventType.ENTERING_IMPROVING);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(enabled("rrg_transition", Severity.INFO)));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    stubBreakdownDisabled();
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

    RotationEvent event = rotationEvent(CategoryId.FINL, RotationEventType.ENTERING_LEADING);

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(enabled("rrg_transition", Severity.ACTION)));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    stubBreakdownDisabled();
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

    RotationEvent event = rotationEvent(CategoryId.TECH, RotationEventType.ENTERING_IMPROVING);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    stubBreakdownDisabled();

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rrg_transition enabled: no duplicate when active alert already exists")
  void shouldNotCreateRrgAlertWhenActiveAlertAlreadyExists() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event = rotationEvent(CategoryId.TECH, RotationEventType.ENTERING_IMPROVING);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(enabled("rrg_transition", Severity.INFO)));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    stubBreakdownDisabled();
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

    RotationEvent event = rotationEvent(CategoryId.TECH, RotationEventType.COMPOSITE_BREAKOUT);

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(enabled("composite_breakout", Severity.ACTION)));
    stubBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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
    stubRrgAndBreakoutAndBreakdownDisabled();
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

  // ===== Composite Breakdown Tests =====

  @Test
  @DisplayName("composite_breakdown enabled: inserts alert for COMPOSITE_BREAKDOWN event")
  void shouldCreateBreakdownAlertForCompositeBreakdownEvent() {
    stubTopLevelCategories("ENRG");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event = rotationEvent(CategoryId.ENRG, RotationEventType.COMPOSITE_BREAKDOWN);

    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    when(alertRulesRepository.findById("composite_breakdown"))
        .thenReturn(Optional.of(enabled("composite_breakdown", Severity.WARNING)));
    when(alertRepository.existsActiveAlert("composite_breakdown", "ENRG")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("composite_breakdown");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.ENRG);
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("ENRG").contains("REDUCE");
  }

  // ===== Persistence Low Tests =====

  @Test
  @DisplayName("persistence_low enabled: inserts alert when sector beats benchmark fewer than threshold days")
  void shouldCreatePersistenceLowAlertWhenDaysBelowThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("persistence_low"))
        .thenReturn(Optional.of(enabledWithPersistenceDays("persistence_low", Severity.WARNING, 7)));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("5")));
    when(alertRepository.existsActiveAlert("persistence_low", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("persistence_low");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("TECH").contains("5").contains("20 trading days");
  }

  @Test
  @DisplayName("persistence_low enabled: no alert when days meet or exceed threshold")
  void shouldNotCreatePersistenceLowAlertWhenDaysAboveThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("persistence_low"))
        .thenReturn(Optional.of(enabledWithPersistenceDays("persistence_low", Severity.WARNING, 7)));
    // 12/20 days — above threshold of 7
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("12")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("persistence_low enabled: no duplicate when active alert already exists")
  void shouldNotCreatePersistenceLowAlertWhenActiveAlertAlreadyExists() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("persistence_low"))
        .thenReturn(Optional.of(enabledWithPersistenceDays("persistence_low", Severity.WARNING, 7)));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(alertRepository.existsActiveAlert("persistence_low", "TECH")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("persistence_low disabled: no alert inserted")
  void shouldNotCreatePersistenceLowAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
    stubPersistenceLowDisabled();

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("resolveStaleAlerts: resolves persistence_low alert when persistence recovers to >= 8 days")
  void shouldResolvePersistenceLowAlertWhenPersistenceRecovers() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.55")));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("10")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("persistence_low", "TECH");
  }

  @Test
  @DisplayName("composite_breakdown disabled: no alert inserted")
  void shouldNotCreateBreakdownAlertWhenRuleDisabled() {
    stubTopLevelCategories("ENRG");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event = rotationEvent(CategoryId.ENRG, RotationEventType.COMPOSITE_BREAKDOWN);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    when(alertRulesRepository.findById("composite_breakdown"))
        .thenReturn(Optional.of(disabled("composite_breakdown")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  // ===== Auto-Resolution Tests =====

  @Test
  @DisplayName("resolveStaleAlerts: resolves composite_breakdown when score recovers above 0.35")
  void shouldResolveBreakdownAlertWhenScoreRecovers() {
    stubTopLevelCategories("MATL");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    // Score is now 0.42 — above the 0.35 threshold — alert should resolve
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("MATL", new BigDecimal("0.42")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("composite_breakdown", "MATL");
  }

  @Test
  @DisplayName("resolveStaleAlerts: resolves composite_breakout when score falls back below 0.70")
  void shouldResolveBreakoutAlertWhenScoreFallsBack() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    // Score is now 0.65 — below the 0.70 breakout threshold — alert should resolve
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.65")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("composite_breakout", "TECH");
  }

  @Test
  @DisplayName("composite_breakdown enabled: no duplicate when active alert already exists")
  void shouldNotCreateBreakdownAlertWhenActiveAlertAlreadyExists() {
    stubTopLevelCategories("MATL");
    stubMacroDisabled();
    stubRsAccelDisabled();

    RotationEvent event = rotationEvent(CategoryId.MATL, RotationEventType.COMPOSITE_BREAKDOWN);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(event));
    when(alertRulesRepository.findById("rrg_transition"))
        .thenReturn(Optional.of(disabled("rrg_transition")));
    when(alertRulesRepository.findById("composite_breakout"))
        .thenReturn(Optional.of(disabled("composite_breakout")));
    when(alertRulesRepository.findById("composite_breakdown"))
        .thenReturn(Optional.of(enabled("composite_breakdown", Severity.WARNING)));
    when(alertRepository.existsActiveAlert("composite_breakdown", "MATL")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }
}

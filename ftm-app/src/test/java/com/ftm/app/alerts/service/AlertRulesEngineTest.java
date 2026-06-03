package com.ftm.app.alerts.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.lenient;
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
import com.ftm.app.domain.CategoryType;
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
    // resolveStaleAlerts always calls these; lenient prevents PotentialStubbingProblem
    // in tests that stub other SignalTypes (RS_60, RS_120, MACRO_REGIME).
    // Tests that need meaningful values for these types override these stubs inline.
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, DATE))
        .thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of());
    // flow_surge, rs_aligned_bull, and pre_buy_flow_surge rules default to disabled; individual tests override
    lenient()
        .when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    lenient()
        .when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    lenient()
        .when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
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
        .set(field(RotationEvent::detectedDate), DATE)
        .create();
  }

  private void stubTopLevelCategories(String... ids) {
    when(categoryRepository.findTopLevelActiveCategoryIds()).thenReturn(Set.of(ids));
    // All test categories are equity sectors; stub the type-filtered query with the same set.
    when(categoryRepository.findTopLevelActiveCategoryIdsByType(CategoryType.EQUITY_SECTOR))
        .thenReturn(Set.of(ids));
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

  private void stubBreadthVelocityDisabled() {
    when(alertRulesRepository.findById("breadth_velocity_accel"))
        .thenReturn(Optional.of(disabled("breadth_velocity_accel")));
    when(alertRulesRepository.findById("breadth_velocity_decel"))
        .thenReturn(Optional.of(disabled("breadth_velocity_decel")));
  }

  private void stubTradeSignalRulesDisabled() {
    when(alertRulesRepository.findById("trade_signal_buy"))
        .thenReturn(Optional.of(disabled("trade_signal_buy")));
    when(alertRulesRepository.findById("trade_signal_reduce"))
        .thenReturn(Optional.of(disabled("trade_signal_reduce")));
    when(alertRulesRepository.findById("score_approaching_buy"))
        .thenReturn(Optional.of(disabled("score_approaching_buy")));
    when(alertRulesRepository.findById("score_approaching_reduce"))
        .thenReturn(Optional.of(disabled("score_approaching_reduce")));
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
  @DisplayName(
      "persistence_low enabled: inserts alert when sector beats benchmark fewer than threshold days")
  void shouldCreatePersistenceLowAlertWhenDaysBelowThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("persistence_low"))
        .thenReturn(
            Optional.of(enabledWithPersistenceDays("persistence_low", Severity.WARNING, 7)));
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
        .thenReturn(
            Optional.of(enabledWithPersistenceDays("persistence_low", Severity.WARNING, 7)));
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
        .thenReturn(
            Optional.of(enabledWithPersistenceDays("persistence_low", Severity.WARNING, 7)));
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
  @DisplayName(
      "resolveStaleAlerts: resolves persistence_low alert when persistence recovers to >= 8 days")
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

  // ===== Breadth Velocity Alert Tests =====

  @Test
  @DisplayName(
      "breadth_velocity_accel: inserts alert when recent-5d breadth rate exceeds prior-15d by ≥+10pp")
  void shouldCreateBreadthVelocityAccelAlertWhenVelocityAboveThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("breadth_velocity_accel"))
        .thenReturn(Optional.of(enabled("breadth_velocity_accel", Severity.INFO)));
    when(alertRulesRepository.findById("breadth_velocity_decel"))
        .thenReturn(Optional.of(disabled("breadth_velocity_decel")));

    // p5=4, p20=6: rate5d=4/5=0.8, rate15=(6-4)/15=0.133, velocity≈+67pp ≥ threshold
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("6")));
    when(alertRepository.existsActiveAlert("breadth_velocity_accel", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("breadth_velocity_accel");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.INFO);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("TECH").contains("breadth velocity");
  }

  @Test
  @DisplayName("breadth_velocity_accel: no alert when velocity is below threshold")
  void shouldNotCreateBreadthVelocityAccelAlertWhenVelocityBelowThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("breadth_velocity_accel"))
        .thenReturn(Optional.of(enabled("breadth_velocity_accel", Severity.INFO)));
    when(alertRulesRepository.findById("breadth_velocity_decel"))
        .thenReturn(Optional.of(disabled("breadth_velocity_decel")));

    // p5=2, p20=8: rate5d=2/5=0.4, rate15=(8-2)/15=0.4, velocity=0pp — no alert
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("2")));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("8")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName(
      "breadth_velocity_decel: inserts alert when recent-5d breadth rate falls below prior-15d by ≥10pp")
  void shouldCreateBreadthVelocityDecelAlertWhenVelocityBelowNegativeThreshold() {
    stubTopLevelCategories("FINL");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("breadth_velocity_accel"))
        .thenReturn(Optional.of(disabled("breadth_velocity_accel")));
    when(alertRulesRepository.findById("breadth_velocity_decel"))
        .thenReturn(Optional.of(enabled("breadth_velocity_decel", Severity.WARNING)));

    // p5=1, p20=10: rate5d=1/5=0.2, rate15=(10-1)/15=0.6, velocity=-40pp ≤ -threshold
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("1")));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("10")));
    when(alertRepository.existsActiveAlert("breadth_velocity_decel", "FINL")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("breadth_velocity_decel");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.FINL);
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("FINL").contains("breadth velocity");
  }

  @Test
  @DisplayName("breadth_velocity_decel: no duplicate when active alert already exists")
  void shouldNotCreateBreadthVelocityDecelAlertWhenActiveAlertExists() {
    stubTopLevelCategories("FINL");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("breadth_velocity_accel"))
        .thenReturn(Optional.of(disabled("breadth_velocity_accel")));
    when(alertRulesRepository.findById("breadth_velocity_decel"))
        .thenReturn(Optional.of(enabled("breadth_velocity_decel", Severity.WARNING)));

    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("1")));
    when(signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("10")));
    when(alertRepository.existsActiveAlert("breadth_velocity_decel", "FINL")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
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

  // ===== High Conviction BUY Alert Tests =====

  @Test
  @DisplayName("high_conviction_buy: inserts ACTION alert when conviction score >= 75")
  void shouldCreateHighConvictionBuyAlertWhenConvictionAboveThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(enabled("high_conviction_buy", Severity.ACTION)));

    // TECH: BUY signal (score=0.82 ≥0.65, rrg=4 Leading, trend20d=0.05 >0)
    // Conviction: BUY=30 + score≥0.80=20 + macroFit≥0.75=18 + pct≥0.85=15 = 83 ≥ 75
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("TECH", new BigDecimal("0.82")),
                SignalType.RRG_QUADRANT, Map.of("TECH", new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D, Map.of("TECH", new BigDecimal("0.05")),
                SignalType.MACRO_FIT, Map.of("TECH", new BigDecimal("0.80")),
                SignalType.COMPOSITE_TREND_5D, Map.of("TECH", new BigDecimal("0.06"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.90")));
    when(alertRepository.existsActiveAlert("high_conviction_buy", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("high_conviction_buy");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.ACTION);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("TECH").contains("conviction");
  }

  @Test
  @DisplayName("high_conviction_buy: no alert when conviction < 75")
  void shouldNotCreateHighConvictionBuyAlertWhenConvictionBelowThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(enabled("high_conviction_buy", Severity.ACTION)));

    // Conviction: BUY=30 + score≥0.65=15 + macroFit≥0.35=5 + pct≥0.50=5 = 55 < 75
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("TECH", new BigDecimal("0.68")),
                SignalType.RRG_QUADRANT, Map.of("TECH", new BigDecimal("3")),
                SignalType.COMPOSITE_TREND_20D, Map.of("TECH", new BigDecimal("0.02")),
                SignalType.MACRO_FIT, Map.of("TECH", new BigDecimal("0.45")),
                SignalType.COMPOSITE_TREND_5D, Map.of("TECH", new BigDecimal("0.03"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.60")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("high_conviction_buy: resolves stale alert when conviction drops below 65")
  void shouldResolveHighConvictionBuyAlertWhenConvictionDropsBelowResolveThreshold() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(enabled("high_conviction_buy", Severity.ACTION)));

    // Conviction: BUY=30 + score≥0.65=15 = 45 < 65 (resolve threshold)
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("TECH", new BigDecimal("0.66")),
                SignalType.RRG_QUADRANT, Map.of("TECH", new BigDecimal("3")),
                SignalType.COMPOSITE_TREND_20D, Map.of("TECH", new BigDecimal("0.01")),
                SignalType.MACRO_FIT, Map.of("TECH", new BigDecimal("0.25")),
                SignalType.COMPOSITE_TREND_5D, Map.of("TECH", new BigDecimal("0.01"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.35")));
    when(alertRepository.existsActiveAlert("high_conviction_buy", "TECH")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("high_conviction_buy", "TECH");
    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("high_conviction_buy: no duplicate when active alert already exists at >= 75 conviction")
  void shouldNotCreateDuplicateHighConvictionBuyAlertWhenActiveAlertExists() {
    stubTopLevelCategories("TECH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(enabled("high_conviction_buy", Severity.ACTION)));

    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE, Map.of("TECH", new BigDecimal("0.85")),
                SignalType.RRG_QUADRANT, Map.of("TECH", new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D, Map.of("TECH", new BigDecimal("0.06")),
                SignalType.MACRO_FIT, Map.of("TECH", new BigDecimal("0.80")),
                SignalType.COMPOSITE_TREND_5D, Map.of("TECH", new BigDecimal("0.08"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.88")));
    when(alertRepository.existsActiveAlert("high_conviction_buy", "TECH")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  // ===== High Conviction Cluster Alert Tests =====

  @Test
  @DisplayName("high_conviction_cluster: inserts alert when ≥3 sectors reach conviction ≥75")
  void shouldCreateHighConvictionClusterAlertWhenThreeOrMoreSectorsAreHighConviction() {
    stubTopLevelCategories("TECH", "FINL", "HLTH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(disabled("high_conviction_buy")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_cluster"))
        .thenReturn(Optional.of(enabled("high_conviction_cluster", Severity.ACTION)));

    // All 3 sectors: score=0.82, rrg=4, trend20d=0.05, macroFit=0.80, percentile=0.90 → conviction 83 ≥ 75
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("TECH", new BigDecimal("0.82"), "FINL", new BigDecimal("0.82"), "HLTH", new BigDecimal("0.82")),
                SignalType.RRG_QUADRANT,
                    Map.of("TECH", new BigDecimal("4"), "FINL", new BigDecimal("4"), "HLTH", new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of("TECH", new BigDecimal("0.05"), "FINL", new BigDecimal("0.05"), "HLTH", new BigDecimal("0.05")),
                SignalType.MACRO_FIT,
                    Map.of("TECH", new BigDecimal("0.80"), "FINL", new BigDecimal("0.80"), "HLTH", new BigDecimal("0.80")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of("TECH", new BigDecimal("0.06"), "FINL", new BigDecimal("0.06"), "HLTH", new BigDecimal("0.06"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.90"), "FINL", new BigDecimal("0.90"), "HLTH", new BigDecimal("0.90")));
    when(alertRepository.existsActiveAlert("high_conviction_cluster", null)).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("high_conviction_cluster");
    assertThat(inserted.categoryId()).isNull();
    assertThat(inserted.severity()).isEqualTo(Severity.ACTION);
    assertThat(inserted.message()).contains("3").containsIgnoringCase("cluster");
  }

  @Test
  @DisplayName("high_conviction_cluster: no alert when fewer than 3 sectors reach conviction ≥75")
  void shouldNotCreateClusterAlertWhenFewerThanThreeSectorsAreHighConviction() {
    stubTopLevelCategories("TECH", "FINL", "HLTH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(disabled("high_conviction_buy")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_cluster"))
        .thenReturn(Optional.of(enabled("high_conviction_cluster", Severity.ACTION)));

    // TECH=83 (high), FINL=55 (not high), HLTH=55 (not high) — only 1 high-conviction → no cluster
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("TECH", new BigDecimal("0.82"), "FINL", new BigDecimal("0.68"), "HLTH", new BigDecimal("0.68")),
                SignalType.RRG_QUADRANT,
                    Map.of("TECH", new BigDecimal("4"), "FINL", new BigDecimal("3"), "HLTH", new BigDecimal("3")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of("TECH", new BigDecimal("0.05"), "FINL", new BigDecimal("0.02"), "HLTH", new BigDecimal("0.02")),
                SignalType.MACRO_FIT,
                    Map.of("TECH", new BigDecimal("0.80"), "FINL", new BigDecimal("0.45"), "HLTH", new BigDecimal("0.45")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of("TECH", new BigDecimal("0.06"), "FINL", new BigDecimal("0.03"), "HLTH", new BigDecimal("0.03"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.90"), "FINL", new BigDecimal("0.60"), "HLTH", new BigDecimal("0.60")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("high_conviction_cluster: resolves when cluster drops below 2 sectors")
  void shouldResolveClusterAlertWhenClusterDropsBelowTwoSectors() {
    stubTopLevelCategories("TECH", "FINL", "HLTH");
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(disabled("high_conviction_buy")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());

    when(alertRulesRepository.findById("high_conviction_cluster"))
        .thenReturn(Optional.of(enabled("high_conviction_cluster", Severity.ACTION)));

    // All 3 sectors below conviction 75 → cluster size = 0, below CLUSTER_RESOLVE_SIZE=2
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of("TECH", new BigDecimal("0.68"), "FINL", new BigDecimal("0.60"), "HLTH", new BigDecimal("0.55")),
                SignalType.RRG_QUADRANT,
                    Map.of("TECH", new BigDecimal("3"), "FINL", new BigDecimal("3"), "HLTH", new BigDecimal("3")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of("TECH", new BigDecimal("0.02"), "FINL", new BigDecimal("0.01"), "HLTH", new BigDecimal("0.01")),
                SignalType.MACRO_FIT,
                    Map.of("TECH", new BigDecimal("0.45"), "FINL", new BigDecimal("0.40"), "HLTH", new BigDecimal("0.35")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of("TECH", new BigDecimal("0.03"), "FINL", new BigDecimal("0.02"), "HLTH", new BigDecimal("0.01"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.60"), "FINL", new BigDecimal("0.50"), "HLTH", new BigDecimal("0.45")));
    when(alertRepository.existsActiveAlert("high_conviction_cluster", null)).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("high_conviction_cluster", null);
    verify(alertRepository, never()).insert(any());
  }

  // ===== Signal Deterioration Alert Tests =====

  private void stubAllRulesDisabledExceptSignalDeterioration() {
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(disabled("high_conviction_buy")));
    when(alertRulesRepository.findById("high_conviction_cluster"))
        .thenReturn(Optional.of(disabled("high_conviction_cluster")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("signal_deterioration: inserts WARNING when BUY-territory score has sharp 5d decline")
  void shouldCreateSignalDeteriorationAlertWhenBuyScoreWithNegativeTrend() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSignalDeterioration();

    when(alertRulesRepository.findById("signal_deterioration"))
        .thenReturn(Optional.of(enabled("signal_deterioration", Severity.WARNING)));
    // TECH: composite=0.70 (≥0.65, in BUY territory), trend5d=-0.07 (< -0.05 threshold)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.70")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.07")));
    when(alertRepository.existsActiveAlert("signal_deterioration", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("signal_deterioration");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("TECH").containsIgnoringCase("deteriorat");
  }

  @Test
  @DisplayName("signal_deterioration: no alert when score below BUY threshold (0.65)")
  void shouldNotCreateSignalDeteriorationAlertWhenScoreBelowBuyThreshold() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSignalDeterioration();

    when(alertRulesRepository.findById("signal_deterioration"))
        .thenReturn(Optional.of(enabled("signal_deterioration", Severity.WARNING)));
    // TECH: composite=0.60 (below 0.65 BUY threshold), trend5d=-0.08 (would qualify if in BUY territory)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.60")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.08")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("signal_deterioration: no alert when 5d trend above deterioration threshold (-0.05)")
  void shouldNotCreateSignalDeteriorationAlertWhenTrendAboveThreshold() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSignalDeterioration();

    when(alertRulesRepository.findById("signal_deterioration"))
        .thenReturn(Optional.of(enabled("signal_deterioration", Severity.WARNING)));
    // TECH: composite=0.72 (in BUY territory), trend5d=-0.03 (above -0.05 threshold — only mild decline)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.72")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.03")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  // ===== Flow Surge Alert Tests =====

  private void stubAllOtherRulesDisabled() {
    stubMacroDisabled();
    stubRsAccelDisabled();
    stubRrgAndBreakoutAndBreakdownDisabled();
    stubPersistenceLowDisabled();
    stubBreadthVelocityDisabled();
    stubTradeSignalRulesDisabled();
    when(alertRulesRepository.findById("high_conviction_buy"))
        .thenReturn(Optional.of(disabled("high_conviction_buy")));
    when(alertRulesRepository.findById("high_conviction_cluster"))
        .thenReturn(Optional.of(disabled("high_conviction_cluster")));
    when(alertRulesRepository.findById("signal_deterioration"))
        .thenReturn(Optional.of(disabled("signal_deterioration")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
  }

  private void stubAllRulesDisabledExceptFlowSurge() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
  }

  private void stubAllRulesDisabledExceptRsAlignedBull() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  private void stubAllRulesDisabledExceptPreBuyFlowSurge() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("flow_surge: inserts INFO alert when FLOW_SURGE rotation event fires for enabled rule")
  void shouldCreateFlowSurgeAlertWhenFlowSurgeEventDetected() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptFlowSurge();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(enabled("flow_surge", Severity.INFO)));

    RotationEvent flowEvent = rotationEvent(CategoryId.TECH, RotationEventType.FLOW_SURGE);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(flowEvent));
    when(alertRepository.existsActiveAlert("flow_surge", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).insert(
        argThat(a -> a.ruleId().equals("flow_surge")
            && a.categoryId() == CategoryId.TECH
            && a.severity() == Severity.INFO
            && a.message().contains("TECH")
            && a.message().contains("inflow")));
  }

  @Test
  @DisplayName("flow_surge: does not insert alert when rule is disabled")
  void shouldNotCreateFlowSurgeAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptFlowSurge();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));

    RotationEvent flowEvent = rotationEvent(CategoryId.TECH, RotationEventType.FLOW_SURGE);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(flowEvent));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("flow_surge: resolves alert when flow z-score drops below 1.0")
  void shouldResolveFlowSurgeAlertWhenFlowDropsBelowThreshold() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptFlowSurge();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(enabled("flow_surge", Severity.INFO)));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
    // Flow z-score = 0.5 (below resolve threshold of 1.0)
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.5")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("flow_surge", "TECH");
  }

  @Test
  @DisplayName("rs_aligned_bull: inserts INFO alert when RS-20 > RS-60 > RS-120 newly aligned")
  void shouldCreateRsAlignedBullAlertWhenAllRsSignalsAlignBullishly() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRsAlignedBull();
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(enabled("rs_aligned_bull", Severity.INFO)));

    // Current: fully aligned (RS-20 > RS-60 > RS-120)
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.050")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.030")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.010")));
    // Previous: NOT aligned (RS-20 < RS-60 yesterday)
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.020")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.035")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.010")));
    when(alertRepository.existsActiveAlert("rs_aligned_bull", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).insert(
        argThat(a -> a.ruleId().equals("rs_aligned_bull")
            && a.categoryId() == CategoryId.TECH
            && a.severity() == Severity.INFO
            && a.message().contains("TECH")
            && a.message().contains("RS-20")));
  }

  @Test
  @DisplayName("rs_aligned_bull: does not insert alert when rule is disabled")
  void shouldNotCreateRsAlignedBullAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRsAlignedBull();
    // rule is disabled (lenient stub from setUp)

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rs_aligned_bull: resolves alert when RS-20 drops below RS-60")
  void shouldResolveRsAlignedBullAlertWhenAlignmentBreaks() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRsAlignedBull();
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(enabled("rs_aligned_bull", Severity.INFO)));
    // RS-20 <= RS-60: alignment broke — should resolve
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.025")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.030")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.010")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, PREV_DATE)).thenReturn(Map.of());
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE)).thenReturn(Map.of());
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE)).thenReturn(Map.of());

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("rs_aligned_bull", "TECH");
  }

  // ===== Pre-BUY Flow Surge Alert Tests =====

  @Test
  @DisplayName("pre_buy_flow_surge: inserts WARNING when sector in approach zone AND flow surging")
  void shouldCreatePreBuyFlowSurgeAlertWhenScoreInApproachZoneAndFlowSurging() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptPreBuyFlowSurge();
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(enabled("pre_buy_flow_surge", Severity.WARNING)));
    // TECH: composite=0.60 (in [0.55, 0.65) approach zone), flow20d=2.0 (≥1.5 surge threshold)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.60")));
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("2.0")));
    when(alertRepository.existsActiveAlert("pre_buy_flow_surge", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("pre_buy_flow_surge");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("TECH").contains("flow").contains("BUY");
  }

  @Test
  @DisplayName("pre_buy_flow_surge: no alert when rule is disabled")
  void shouldNotCreatePreBuyFlowSurgeAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptPreBuyFlowSurge();
    // rule disabled (setUp lenient stub)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.60")));
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("2.0")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("pre_buy_flow_surge: no alert when score reaches full BUY zone (≥0.65)")
  void shouldNotCreatePreBuyFlowSurgeAlertWhenScoreAlreadyInBuyZone() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptPreBuyFlowSurge();
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(enabled("pre_buy_flow_surge", Severity.WARNING)));
    // TECH: composite=0.70 (above 0.65 — already in full BUY zone, not approach zone)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.70")));
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("2.0")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }
}

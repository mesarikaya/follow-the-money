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
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
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
  @Mock ThemeRepository themeRepository;

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
            categoryRepository,
            themeRepository);
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
    lenient().when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE)).thenReturn(Map.of());
    lenient().when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE)).thenReturn(Map.of());
    lenient()
        .when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of());
    lenient().when(themeRepository.findAllConstituentsByTheme()).thenReturn(Map.of());
    // flow_surge, rs_aligned_bull, rs_aligned_bear, pre_buy_flow_surge, and
    // high_conviction_reduce_cluster rules default to disabled; individual tests override
    lenient()
        .when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    lenient()
        .when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    lenient()
        .when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    lenient()
        .when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    lenient()
        .when(alertRulesRepository.findById("high_conviction_reduce_cluster"))
        .thenReturn(Optional.of(disabled("high_conviction_reduce_cluster")));
    lenient()
        .when(alertRulesRepository.findById("rs_breadth_bull"))
        .thenReturn(Optional.of(disabled("rs_breadth_bull")));
    lenient()
        .when(alertRulesRepository.findById("rs_breadth_bear"))
        .thenReturn(Optional.of(disabled("rs_breadth_bear")));
    lenient()
        .when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    lenient()
        .when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    lenient()
        .when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    lenient()
        .when(alertRulesRepository.findById("multi_alert_bull_confluence"))
        .thenReturn(Optional.of(disabled("multi_alert_bull_confluence")));
    lenient()
        .when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(disabled("cross_horizon_rs_divergence")));
    lenient()
        .when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(disabled("macro_sector_mismatch")));
    lenient()
        .when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(disabled("sub_sector_breadth_divergence")));
    lenient()
        .when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(disabled("sub_sector_bull_confluence")));
    lenient().when(signalRepository.findScorePercentile252d()).thenReturn(Map.of());
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
  @DisplayName(
      "high_conviction_buy: no duplicate when active alert already exists at >= 75 conviction")
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

    // All 3 sectors: score=0.82, rrg=4, trend20d=0.05, macroFit=0.80, percentile=0.90 → conviction
    // 83 ≥ 75
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.82"),
                        "FINL",
                        new BigDecimal("0.82"),
                        "HLTH",
                        new BigDecimal("0.82")),
                SignalType.RRG_QUADRANT,
                    Map.of(
                        "TECH",
                        new BigDecimal("4"),
                        "FINL",
                        new BigDecimal("4"),
                        "HLTH",
                        new BigDecimal("4")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.05"),
                        "FINL",
                        new BigDecimal("0.05"),
                        "HLTH",
                        new BigDecimal("0.05")),
                SignalType.MACRO_FIT,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.80"),
                        "FINL",
                        new BigDecimal("0.80"),
                        "HLTH",
                        new BigDecimal("0.80")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.06"),
                        "FINL",
                        new BigDecimal("0.06"),
                        "HLTH",
                        new BigDecimal("0.06"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.90"),
                "FINL",
                new BigDecimal("0.90"),
                "HLTH",
                new BigDecimal("0.90")));
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
                    Map.of(
                        "TECH",
                        new BigDecimal("0.82"),
                        "FINL",
                        new BigDecimal("0.68"),
                        "HLTH",
                        new BigDecimal("0.68")),
                SignalType.RRG_QUADRANT,
                    Map.of(
                        "TECH",
                        new BigDecimal("4"),
                        "FINL",
                        new BigDecimal("3"),
                        "HLTH",
                        new BigDecimal("3")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.05"),
                        "FINL",
                        new BigDecimal("0.02"),
                        "HLTH",
                        new BigDecimal("0.02")),
                SignalType.MACRO_FIT,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.80"),
                        "FINL",
                        new BigDecimal("0.45"),
                        "HLTH",
                        new BigDecimal("0.45")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.06"),
                        "FINL",
                        new BigDecimal("0.03"),
                        "HLTH",
                        new BigDecimal("0.03"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.90"),
                "FINL",
                new BigDecimal("0.60"),
                "HLTH",
                new BigDecimal("0.60")));

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
                    Map.of(
                        "TECH",
                        new BigDecimal("0.68"),
                        "FINL",
                        new BigDecimal("0.60"),
                        "HLTH",
                        new BigDecimal("0.55")),
                SignalType.RRG_QUADRANT,
                    Map.of(
                        "TECH",
                        new BigDecimal("3"),
                        "FINL",
                        new BigDecimal("3"),
                        "HLTH",
                        new BigDecimal("3")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.02"),
                        "FINL",
                        new BigDecimal("0.01"),
                        "HLTH",
                        new BigDecimal("0.01")),
                SignalType.MACRO_FIT,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.45"),
                        "FINL",
                        new BigDecimal("0.40"),
                        "HLTH",
                        new BigDecimal("0.35")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.03"),
                        "FINL",
                        new BigDecimal("0.02"),
                        "HLTH",
                        new BigDecimal("0.01"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.60"),
                "FINL",
                new BigDecimal("0.50"),
                "HLTH",
                new BigDecimal("0.45")));
    when(alertRepository.existsActiveAlert("high_conviction_cluster", null)).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("high_conviction_cluster", null);
    verify(alertRepository, never()).insert(any());
  }

  // ===== High Conviction REDUCE Cluster Alert Tests =====

  @Test
  @DisplayName(
      "high_conviction_reduce_cluster: inserts ACTION when ≥3 sectors are high-conviction REDUCE")
  void shouldCreateReduceClusterAlertWhenThreeOrMoreSectorsAreHighConvictionReduce() {
    stubTopLevelCategories("TECH", "FINL", "HLTH");
    stubAllRulesDisabledExceptReduceCluster();
    when(alertRulesRepository.findById("high_conviction_reduce_cluster"))
        .thenReturn(Optional.of(enabled("high_conviction_reduce_cluster", Severity.ACTION)));

    // All 3 sectors: score=0.28 (<0.35 → REDUCE), rrg=1 (Lagging), trend20d=-0.04,
    // trend5d=-0.08 (accel=-0.04 clearly ≤ -0.02 → +12), flow20d=-2.0 (<-1.5 → +5)
    // conviction = 25 + 12 + 5 = 42 ≥ 40
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.28"),
                        "FINL",
                        new BigDecimal("0.28"),
                        "HLTH",
                        new BigDecimal("0.28")),
                SignalType.RRG_QUADRANT,
                    Map.of(
                        "TECH",
                        new BigDecimal("1"),
                        "FINL",
                        new BigDecimal("1"),
                        "HLTH",
                        new BigDecimal("1")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("-0.04"),
                        "FINL",
                        new BigDecimal("-0.04"),
                        "HLTH",
                        new BigDecimal("-0.04")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of(
                        "TECH",
                        new BigDecimal("-0.08"),
                        "FINL",
                        new BigDecimal("-0.08"),
                        "HLTH",
                        new BigDecimal("-0.08")),
                SignalType.FLOW_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("-2.0"),
                        "FINL",
                        new BigDecimal("-2.0"),
                        "HLTH",
                        new BigDecimal("-2.0"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.10"),
                "FINL",
                new BigDecimal("0.10"),
                "HLTH",
                new BigDecimal("0.10")));
    when(alertRepository.existsActiveAlert("high_conviction_reduce_cluster", null))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("high_conviction_reduce_cluster");
    assertThat(inserted.categoryId()).isNull();
    assertThat(inserted.severity()).isEqualTo(Severity.ACTION);
    assertThat(inserted.message()).contains("3").containsIgnoringCase("cluster");
  }

  @Test
  @DisplayName(
      "high_conviction_reduce_cluster: no alert when fewer than 3 sectors are high-conviction REDUCE")
  void shouldNotCreateReduceClusterAlertWhenFewerThanThreeSectorsQualify() {
    stubTopLevelCategories("TECH", "FINL", "HLTH");
    stubAllRulesDisabledExceptReduceCluster();
    when(alertRulesRepository.findById("high_conviction_reduce_cluster"))
        .thenReturn(Optional.of(enabled("high_conviction_reduce_cluster", Severity.ACTION)));

    // TECH: REDUCE conviction 42 (qualifies), FINL+HLTH: REDUCE but conviction=34 only (below 40)
    // TECH: accel=-0.08-(-0.04)=-0.04 ≤ -0.02 → +12; flow=-2.0 < -1.5 → +5; total=25+12+5=42
    // FINL/HLTH: accel=-0.01-(-0.01)=0 → +4 only; flow=0.1 → 0; total=25+4=29
    when(signalRepository.findLatestByTypes(any()))
        .thenReturn(
            Map.of(
                SignalType.COMPOSITE,
                    Map.of(
                        "TECH",
                        new BigDecimal("0.28"),
                        "FINL",
                        new BigDecimal("0.28"),
                        "HLTH",
                        new BigDecimal("0.28")),
                SignalType.RRG_QUADRANT,
                    Map.of(
                        "TECH",
                        new BigDecimal("1"),
                        "FINL",
                        new BigDecimal("2"),
                        "HLTH",
                        new BigDecimal("2")),
                SignalType.COMPOSITE_TREND_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("-0.04"),
                        "FINL",
                        new BigDecimal("-0.01"),
                        "HLTH",
                        new BigDecimal("-0.01")),
                SignalType.COMPOSITE_TREND_5D,
                    Map.of(
                        "TECH",
                        new BigDecimal("-0.08"),
                        "FINL",
                        new BigDecimal("-0.01"),
                        "HLTH",
                        new BigDecimal("-0.01")),
                SignalType.FLOW_20D,
                    Map.of(
                        "TECH",
                        new BigDecimal("-2.0"),
                        "FINL",
                        new BigDecimal("0.1"),
                        "HLTH",
                        new BigDecimal("0.1"))));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.10"),
                "FINL",
                new BigDecimal("0.40"),
                "HLTH",
                new BigDecimal("0.40")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

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
    when(alertRulesRepository.findById("high_conviction_reduce_cluster"))
        .thenReturn(Optional.of(disabled("high_conviction_reduce_cluster")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "signal_deterioration: inserts WARNING when BUY-territory score has sharp 5d decline")
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
    // TECH: composite=0.60 (below 0.65 BUY threshold), trend5d=-0.08 (would qualify if in BUY
    // territory)
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
    // TECH: composite=0.72 (in BUY territory), trend5d=-0.03 (above -0.05 threshold — only mild
    // decline)
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
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("high_conviction_reduce_cluster"))
        .thenReturn(Optional.of(disabled("high_conviction_reduce_cluster")));
    when(alertRulesRepository.findById("rs_breadth_bull"))
        .thenReturn(Optional.of(disabled("rs_breadth_bull")));
    when(alertRulesRepository.findById("rs_breadth_bear"))
        .thenReturn(Optional.of(disabled("rs_breadth_bear")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(alertRulesRepository.findById("multi_alert_bull_confluence"))
        .thenReturn(Optional.of(disabled("multi_alert_bull_confluence")));
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(disabled("cross_horizon_rs_divergence")));
    when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(disabled("macro_sector_mismatch")));
    when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(disabled("sub_sector_breadth_divergence")));
    when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(disabled("sub_sector_bull_confluence")));
    when(alertRulesRepository.findById("theme_dominant_signal_transition"))
        .thenReturn(Optional.of(disabled("theme_dominant_signal_transition")));
    when(alertRulesRepository.findById("theme_momentum_surge"))
        .thenReturn(Optional.of(disabled("theme_momentum_surge")));
    when(alertRulesRepository.findById("theme_momentum_collapse"))
        .thenReturn(Optional.of(disabled("theme_momentum_collapse")));
    when(alertRulesRepository.findById("theme_5d_acceleration"))
        .thenReturn(Optional.of(disabled("theme_5d_acceleration")));
    when(alertRulesRepository.findById("theme_distribute_warning"))
        .thenReturn(Optional.of(disabled("theme_distribute_warning")));
    when(alertRulesRepository.findById("theme_phase_breakout_entry"))
        .thenReturn(Optional.of(disabled("theme_phase_breakout_entry")));
  }

  private void stubAllRulesDisabledExceptFlowSurge() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
  }

  private void stubAllRulesDisabledExceptRsAlignedBull() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  private void stubAllRulesDisabledExceptRsAlignedBear() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  private void stubAllRulesDisabledExceptPreBuyFlowSurge() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  private void stubAllRulesDisabledExceptReduceCluster() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "flow_surge: inserts INFO alert when FLOW_SURGE rotation event fires for enabled rule")
  void shouldCreateFlowSurgeAlertWhenFlowSurgeEventDetected() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptFlowSurge();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(enabled("flow_surge", Severity.INFO)));

    RotationEvent flowEvent = rotationEvent(CategoryId.TECH, RotationEventType.FLOW_SURGE);
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of(flowEvent));
    when(alertRepository.existsActiveAlert("flow_surge", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("flow_surge")
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

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("rs_aligned_bull")
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

  // ===== RS Aligned Bear Alert Tests =====

  @Test
  @DisplayName("rs_aligned_bear: inserts WARNING when RS-20 < RS-60 < RS-120 fully aligned bearish")
  void shouldCreateRsAlignedBearAlertWhenAllRsAlignedBearish() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRsAlignedBear();
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(enabled("rs_aligned_bear", Severity.WARNING)));
    // RS-20 < RS-60 < RS-120: fully aligned bearish
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.040")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.020")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.005")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV_DATE);
    // previous day: NOT fully aligned (RS-20 was above RS-60) → this is the first day → should fire
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.015")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.020")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.005")));
    when(alertRepository.existsActiveAlert("rs_aligned_bear", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("rs_aligned_bear");
    assertThat(inserted.categoryId()).isEqualTo(CategoryId.TECH);
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.message()).contains("TECH");
    assertThat(inserted.message()).contains("bearish");
  }

  @Test
  @DisplayName("rs_aligned_bear: does not insert alert when rule is disabled")
  void shouldNotCreateRsAlignedBearAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRsAlignedBear();
    // rule is disabled (lenient stub from setUp)

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rs_aligned_bear: resolves alert when RS-20 rises back to or above RS-60")
  void shouldResolveRsAlignedBearAlertWhenAlignmentBreaks() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRsAlignedBear();
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(enabled("rs_aligned_bear", Severity.WARNING)));
    // RS-20 >= RS-60: bearish alignment broke — should resolve
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.015")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.020")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.005")));
    when(signalRepository.findPreviousSignalDate(SignalType.RS_20, DATE)).thenReturn(PREV_DATE);
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, PREV_DATE)).thenReturn(Map.of());
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, PREV_DATE)).thenReturn(Map.of());
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, PREV_DATE)).thenReturn(Map.of());

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("rs_aligned_bear", "TECH");
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

  // ===== RS Breadth Extreme Alert Tests =====

  private void stubAllRulesDisabledExceptRsBreadth() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("rs_breadth_bull: inserts INFO alert when ≥60% of equity sectors have RS-20 > RS-60")
  void shouldCreateRsBreadthBullAlertWhenMajorityOfSectorsShowRsAcceleration() {
    // 7 equity categories; 6/7 = 86% have RS-20 > RS-60 → fires
    stubTopLevelCategories("TECH", "FINL", "HLTH", "INDU", "ENRG", "MATL", "UTIL");
    stubAllRulesDisabledExceptRsBreadth();
    when(alertRulesRepository.findById("rs_breadth_bull"))
        .thenReturn(Optional.of(enabled("rs_breadth_bull", Severity.INFO)));

    // RS-20 > RS-60 for 6 sectors, RS-20 < RS-60 for 1 (UTIL)
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.80"),
                "FINL",
                new BigDecimal("0.70"),
                "HLTH",
                new BigDecimal("0.65"),
                "INDU",
                new BigDecimal("0.60"),
                "ENRG",
                new BigDecimal("0.55"),
                "MATL",
                new BigDecimal("0.50"),
                "UTIL",
                new BigDecimal("0.30")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.70"),
                "FINL",
                new BigDecimal("0.60"),
                "HLTH",
                new BigDecimal("0.55"),
                "INDU",
                new BigDecimal("0.50"),
                "ENRG",
                new BigDecimal("0.45"),
                "MATL",
                new BigDecimal("0.40"),
                "UTIL",
                new BigDecimal("0.45"))); // UTIL: RS-20(0.30) < RS-60(0.45) → bear
    when(alertRepository.existsActiveAlert("rs_breadth_bull", null)).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("rs_breadth_bull")
                        && a.categoryId() == null
                        && a.severity() == Severity.INFO
                        && a.message().contains("6/7")
                        && a.message().contains("RS-20 > RS-60")));
  }

  private void stubAllRulesDisabledExceptRrgRsDivergence() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "rs_breadth_bear: inserts WARNING alert when ≥60% of equity sectors have RS-20 < RS-60")
  void shouldCreateRsBreadthBearAlertWhenMajorityOfSectorsShowRsDeterioration() {
    // 7 equity categories; 7/7 = 100% have RS-20 < RS-60 → fires
    stubTopLevelCategories("TECH", "FINL", "HLTH", "INDU", "ENRG", "MATL", "UTIL");
    stubAllRulesDisabledExceptRsBreadth();
    when(alertRulesRepository.findById("rs_breadth_bear"))
        .thenReturn(Optional.of(enabled("rs_breadth_bear", Severity.WARNING)));

    // All sectors: RS-20 < RS-60 (bear breadth)
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.40"),
                "FINL",
                new BigDecimal("0.35"),
                "HLTH",
                new BigDecimal("0.30"),
                "INDU",
                new BigDecimal("0.28"),
                "ENRG",
                new BigDecimal("0.25"),
                "MATL",
                new BigDecimal("0.22"),
                "UTIL",
                new BigDecimal("0.20")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(
            Map.of(
                "TECH",
                new BigDecimal("0.60"),
                "FINL",
                new BigDecimal("0.55"),
                "HLTH",
                new BigDecimal("0.50"),
                "INDU",
                new BigDecimal("0.48"),
                "ENRG",
                new BigDecimal("0.45"),
                "MATL",
                new BigDecimal("0.42"),
                "UTIL",
                new BigDecimal("0.40")));
    when(alertRepository.existsActiveAlert("rs_breadth_bear", null)).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("rs_breadth_bear")
                        && a.categoryId() == null
                        && a.severity() == Severity.WARNING
                        && a.message().contains("7/7")
                        && a.message().contains("RS-20 < RS-60")));
  }

  // ===== RRG/RS Divergence Alert Tests =====

  @Test
  @DisplayName(
      "rrg_rs_divergence: inserts WARNING for bearish divergence (Leading RRG but RS-20 < RS-60)")
  void shouldCreateRrgRsDivergenceAlertForBearishDivergenceWhenLeadingButRsCracking() {
    // TECH in Q4 (Leading) but RS-20 < RS-60 — momentum cracking while RRG still shows strength
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRrgRsDivergence();
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(enabled("rrg_rs_divergence", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4"))); // Q4 = Leading
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.05"))); // RS-20 < RS-60
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.10"))); // RS-60 > RS-20 → bearish divergence
    when(alertRepository.existsActiveAlert("rrg_rs_divergence", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("rrg_rs_divergence")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("BEARISH DIVERGENCE")
                        && a.message().contains("Leading")));
  }

  @Test
  @DisplayName(
      "rrg_rs_divergence: inserts WARNING for bullish divergence (Lagging RRG but RS-20 > RS-60)")
  void shouldCreateRrgRsDivergenceAlertForBullishDivergenceWhenLaggingButRsRecovering() {
    // FINL in Q1 (Lagging) but RS-20 > RS-60 — early recovery signal before RRG catches up
    stubTopLevelCategories("FINL");
    stubAllRulesDisabledExceptRrgRsDivergence();
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(enabled("rrg_rs_divergence", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("1"))); // Q1 = Lagging
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("0.12"))); // RS-20 > RS-60 → bullish divergence
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("FINL", new BigDecimal("0.07")));
    when(alertRepository.existsActiveAlert("rrg_rs_divergence", "FINL")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("rrg_rs_divergence")
                        && a.categoryId() == CategoryId.FINL
                        && a.severity() == Severity.WARNING
                        && a.message().contains("FINL")
                        && a.message().contains("BULLISH DIVERGENCE")
                        && a.message().contains("Lagging")));
  }

  @Test
  @DisplayName("rrg_rs_divergence: no alert when rule is disabled")
  void shouldNotCreateRrgRsDivergenceAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRrgRsDivergence();
    // rule stays disabled (setUp lenient stub — engine returns early, no signal data fetched)

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rrg_rs_divergence: no alert when RRG and RS-20/60 agree (no divergence)")
  void shouldNotCreateRrgRsDivergenceAlertWhenNoConflictBetweenRrgAndRs() {
    // TECH in Q4 (Leading) AND RS-20 > RS-60 — no divergence
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRrgRsDivergence();
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(enabled("rrg_rs_divergence", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4"))); // Leading
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.15"))); // RS-20 > RS-60 — agrees with Q4
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.10")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("rrg_rs_divergence: resolves when divergence closes")
  void shouldResolveRrgRsDivergenceAlertWhenDivergenceCloses() {
    // TECH was diverging (Q4 + RS-20 < RS-60), but now RS-20 > RS-60 (aligned with Q4)
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptRrgRsDivergence();
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(enabled("rrg_rs_divergence", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4"))); // Still Leading
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(
            Map.of("TECH", new BigDecimal("0.15"))); // RS-20 now > RS-60 (divergence closed)
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.10")));
    when(alertRepository.existsActiveAlert("rrg_rs_divergence", "TECH"))
        .thenReturn(true); // was active

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("rrg_rs_divergence", "TECH");
    verify(alertRepository, never()).insert(any());
  }

  // ─── score_percentile_extreme ───────────────────────────────────────────────

  private void stubAllRulesDisabledExceptScorePercentileExtreme() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "score_percentile_extreme: fires WARNING alert when sector is at 252d HIGH (≥90th pct)")
  void shouldCreateScorePercentileExtremeHighAlertWhenSectorAtHistoricHigh() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScorePercentileExtreme();
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(enabled("score_percentile_extreme", Severity.WARNING)));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.93"))); // 93rd percentile — at historic high
    when(alertRepository.existsActiveAlert("score_percentile_extreme", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("score_percentile_extreme")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("HIGH")));
  }

  @Test
  @DisplayName(
      "score_percentile_extreme: fires WARNING alert when sector is at 252d LOW (≤10th pct)")
  void shouldCreateScorePercentileExtremeLowAlertWhenSectorAtHistoricLow() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScorePercentileExtreme();
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(enabled("score_percentile_extreme", Severity.WARNING)));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.07"))); // 7th percentile — at historic low
    when(alertRepository.existsActiveAlert("score_percentile_extreme", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("score_percentile_extreme")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("LOW")));
  }

  @Test
  @DisplayName("score_percentile_extreme: no alert when rule disabled")
  void shouldNotCreateScorePercentileExtremeAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScorePercentileExtreme();
    // rule stays disabled — engine returns early without fetching percentile data

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("score_percentile_extreme: no alert when percentile is in normal range (20th–80th)")
  void shouldNotCreateScorePercentileExtremeAlertWhenPercentileIsNormal() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScorePercentileExtreme();
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(enabled("score_percentile_extreme", Severity.WARNING)));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.55"))); // 55th percentile — normal range
    when(alertRepository.existsActiveAlert("score_percentile_extreme", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  // ─── score_velocity ─────────────────────────────────────────────────────────

  private void stubAllRulesDisabledExceptScoreVelocity() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("score_velocity: fires WARNING alert when 5d trend surges ≥ +12pts")
  void shouldCreateScoreVelocitySurgeAlertWhenTrendSurgesAboveThreshold() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScoreVelocity();
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(enabled("score_velocity", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.14"))); // +14pts — above +12 threshold
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.59")));
    when(alertRepository.existsActiveAlert("score_velocity", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("score_velocity")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("SURGE")));
  }

  @Test
  @DisplayName("score_velocity: fires WARNING alert when 5d trend crashes ≤ -12pts")
  void shouldCreateScoreVelocityCrashAlertWhenTrendDropsBelowThreshold() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScoreVelocity();
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(enabled("score_velocity", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("-0.15"))); // -15pts — below -12 threshold
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.45")));
    when(alertRepository.existsActiveAlert("score_velocity", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("score_velocity")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("CRASH")));
  }

  @Test
  @DisplayName("score_velocity: no alert when rule disabled")
  void shouldNotCreateScoreVelocityAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScoreVelocity();
    // rule stays disabled — engine returns early

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("score_velocity: no alert when 5d trend is within normal range")
  void shouldNotCreateScoreVelocityAlertWhenTrendIsNormal() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScoreVelocity();
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(enabled("score_velocity", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.04"))); // +4pts — normal, below threshold
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.55")));
    when(alertRepository.existsActiveAlert("score_velocity", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("score_velocity: resolves when trend moderates back to normal")
  void shouldResolveScoreVelocityAlertWhenTrendModerates() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScoreVelocity();
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(enabled("score_velocity", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.03"))); // returned to normal
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.62")));
    when(alertRepository.existsActiveAlert("score_velocity", "TECH"))
        .thenReturn(true); // was active

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("score_velocity", "TECH");
    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("score_percentile_extreme: resolves when percentile returns to normal range")
  void shouldResolveScorePercentileExtremeAlertWhenPercentileReturnsToNormal() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptScorePercentileExtreme();
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(enabled("score_percentile_extreme", Severity.WARNING)));
    when(signalRepository.findScorePercentile252d())
        .thenReturn(Map.of("TECH", new BigDecimal("0.50"))); // returned to mid-range
    when(alertRepository.existsActiveAlert("score_percentile_extreme", "TECH"))
        .thenReturn(true); // was active

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("score_percentile_extreme", "TECH");
    verify(alertRepository, never()).insert(any());
  }

  // ─── multi_alert_bull_confluence ────────────────────────────────────────────

  private void stubAllRulesDisabledExceptMultiAlertBull() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "multi_alert_bull_confluence: fires ACTION when ≥3 bullish alerts are simultaneously active")
  void shouldCreateMultiAlertBullConfluenceWhenThreeOrMoreBullishAlertsActive() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMultiAlertBull();
    when(alertRulesRepository.findById("multi_alert_bull_confluence"))
        .thenReturn(Optional.of(enabled("multi_alert_bull_confluence", Severity.ACTION)));
    // 3 bullish alerts active for TECH
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("high_conviction_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("rs_aligned_bull", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("score_approaching_buy", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("pre_buy_flow_surge", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("breadth_velocity_accel", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("composite_breakout", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("multi_alert_bull_confluence", "TECH"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("multi_alert_bull_confluence")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.ACTION
                        && a.message().contains("TECH")
                        && a.message().contains("3")));
  }

  @Test
  @DisplayName("multi_alert_bull_confluence: no alert when fewer than 3 bullish alerts active")
  void shouldNotCreateMultiAlertBullConfluenceWhenFewerThanThreeBullishAlertsActive() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMultiAlertBull();
    when(alertRulesRepository.findById("multi_alert_bull_confluence"))
        .thenReturn(Optional.of(enabled("multi_alert_bull_confluence", Severity.ACTION)));
    // Only 2 bullish alerts — below threshold
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("high_conviction_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("rs_aligned_bull", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("score_approaching_buy", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("pre_buy_flow_surge", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("breadth_velocity_accel", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("composite_breakout", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("multi_alert_bull_confluence", "TECH"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("multi_alert_bull_confluence")));
  }

  @Test
  @DisplayName("multi_alert_bull_confluence: no alert when rule disabled")
  void shouldNotCreateMultiAlertBullConfluenceWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMultiAlertBull();
    // rule stays disabled — engine returns early

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("multi_alert_bull_confluence")));
  }

  @Test
  @DisplayName("multi_alert_bull_confluence: resolves when active count drops below threshold")
  void shouldResolveMultiAlertBullConfluenceWhenActiveBullishAlertsDrop() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMultiAlertBull();
    when(alertRulesRepository.findById("multi_alert_bull_confluence"))
        .thenReturn(Optional.of(enabled("multi_alert_bull_confluence", Severity.ACTION)));
    // Now only 1 bullish alert active — below threshold; confluence should resolve
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("high_conviction_buy", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("rs_aligned_bull", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("score_approaching_buy", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("pre_buy_flow_surge", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("breadth_velocity_accel", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("composite_breakout", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("multi_alert_bull_confluence", "TECH"))
        .thenReturn(true); // was active

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("multi_alert_bull_confluence", "TECH");
    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("multi_alert_bull_confluence")));
  }

  // ─── cross_horizon_rs_divergence ─────────────────────────────────────────────

  private void stubAllRulesDisabledExceptCrossHorizonRsDiv() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "cross_horizon_rs_divergence: fires WARNING when short-term RS bull contradicts medium-term RS bear (counter-trend bounce)")
  void shouldCreateCrossHorizonDivAlertForCounterTrendBounce() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptCrossHorizonRsDiv();
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(enabled("cross_horizon_rs_divergence", Severity.WARNING)));
    // rs20 > rs60 (short-term bull) but rs60 < rs120 (medium-term bear) → counter-trend bounce
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.600")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.580")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.610")));
    when(alertRepository.existsActiveAlert("cross_horizon_rs_divergence", "TECH"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("cross_horizon_rs_divergence")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("counter-trend")));
  }

  @Test
  @DisplayName(
      "cross_horizon_rs_divergence: fires WARNING when short-term RS bear contradicts medium-term RS bull (pullback in bull)")
  void shouldCreateCrossHorizonDivAlertForPullbackInBull() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptCrossHorizonRsDiv();
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(enabled("cross_horizon_rs_divergence", Severity.WARNING)));
    // rs20 < rs60 (short-term bear) but rs60 > rs120 (medium-term bull) → pullback in a bull
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.560")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.590")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.565")));
    when(alertRepository.existsActiveAlert("cross_horizon_rs_divergence", "TECH"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("cross_horizon_rs_divergence")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("pullback")));
  }

  @Test
  @DisplayName("cross_horizon_rs_divergence: no alert when rule disabled")
  void shouldNotCreateCrossHorizonDivAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptCrossHorizonRsDiv();
    // rule stays disabled — engine returns early

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName(
      "cross_horizon_rs_divergence: no alert when all RS horizons are aligned (rs20 > rs60 > rs120)")
  void shouldNotCreateCrossHorizonDivAlertWhenHorizonsAreAligned() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptCrossHorizonRsDiv();
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(enabled("cross_horizon_rs_divergence", Severity.WARNING)));
    // All aligned bullish: rs20 > rs60 > rs120 — no divergence
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.620")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.590")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.560")));
    when(alertRepository.existsActiveAlert("cross_horizon_rs_divergence", "TECH"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName(
      "cross_horizon_rs_divergence: resolves when horizons re-align after prior divergence")
  void shouldResolveCrossHorizonDivAlertWhenHorizonsRealign() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptCrossHorizonRsDiv();
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(enabled("cross_horizon_rs_divergence", Severity.WARNING)));
    // Horizons now aligned — divergence closed
    when(signalRepository.findByTypeAndDate(SignalType.RS_20, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.600")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_60, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.580")));
    when(signalRepository.findByTypeAndDate(SignalType.RS_120, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.555")));
    when(alertRepository.existsActiveAlert("cross_horizon_rs_divergence", "TECH")).thenReturn(true);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("cross_horizon_rs_divergence", "TECH");
    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("cross_horizon_rs_divergence")));
  }

  // ─── macro_sector_mismatch ───────────────────────────────────────────────────

  private static final BigDecimal RISK_OFF_REGIME = new BigDecimal("1"); // RISK_OFF_FLIGHT ordinal
  private static final BigDecimal RISK_ON_REGIME = new BigDecimal("2"); // RISK_ON_GROWTH ordinal

  private void stubAllRulesDisabledExceptMacroSectorMismatch() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(disabled("cross_horizon_rs_divergence")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "macro_sector_mismatch: fires WARNING when cyclical sector is Leading during risk-off regime")
  void shouldCreateMacroSectorMismatchAlertWhenCyclicalLeadsInRiskOff() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMacroSectorMismatch();
    when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(enabled("macro_sector_mismatch", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("MACRO", RISK_OFF_REGIME)); // RISK_OFF_FLIGHT
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4"))); // Leading
    when(alertRepository.existsActiveAlert("macro_sector_mismatch", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("macro_sector_mismatch")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("RISK_OFF_FLIGHT")));
  }

  @Test
  @DisplayName("macro_sector_mismatch: no alert when cyclical sector is in risk-on regime")
  void shouldNotCreateMacroSectorMismatchAlertWhenRegimeIsRiskOn() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMacroSectorMismatch();
    when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(enabled("macro_sector_mismatch", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("MACRO", RISK_ON_REGIME)); // RISK_ON_GROWTH — no mismatch
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4"))); // Leading — expected in risk-on
    when(alertRepository.existsActiveAlert("macro_sector_mismatch", "TECH")).thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("macro_sector_mismatch: no alert when rule is disabled")
  void shouldNotCreateMacroSectorMismatchAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMacroSectorMismatch();
    // rule stays disabled

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never()).insert(any());
  }

  @Test
  @DisplayName("macro_sector_mismatch: resolves when regime returns to risk-on")
  void shouldResolveMacroSectorMismatchWhenRegimeReturnsToRiskOn() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptMacroSectorMismatch();
    when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(enabled("macro_sector_mismatch", Severity.WARNING)));
    when(signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, DATE))
        .thenReturn(Map.of("MACRO", RISK_ON_REGIME)); // now risk-on — mismatch gone
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("4")));
    when(alertRepository.existsActiveAlert("macro_sector_mismatch", "TECH"))
        .thenReturn(true); // was active

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("macro_sector_mismatch", "TECH");
    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("macro_sector_mismatch")));
  }

  // ===== Sub-Sector Breadth Divergence Alert Tests =====

  private List<Category> techSubSectors() {
    return List.of(
        new Category(
            CategoryId.SEMI,
            "Semiconductors",
            CategoryType.EQUITY_SECTOR,
            "SOXX",
            "XLK",
            101,
            true,
            "TECH"),
        new Category(
            CategoryId.AIRO,
            "Aerospace & Defense",
            CategoryType.EQUITY_SECTOR,
            "XAR",
            "XLK",
            102,
            true,
            "TECH"),
        new Category(
            CategoryId.CLOD,
            "Cloud Computing",
            CategoryType.EQUITY_SECTOR,
            "SKYY",
            "XLK",
            103,
            true,
            "TECH"),
        new Category(
            CategoryId.SOFT,
            "Software",
            CategoryType.EQUITY_SECTOR,
            "IGV",
            "XLK",
            104,
            true,
            "TECH"));
  }

  private void stubAllRulesDisabledExceptSubSectorBreadthDiv() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(disabled("cross_horizon_rs_divergence")));
    when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(disabled("macro_sector_mismatch")));
    when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(disabled("sub_sector_bull_confluence")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "sub_sector_breadth_divergence: fires WARNING when parent has BUY signal but <40% of sub-sectors are in Leading/Improving RRG")
  void shouldCreateSubSectorBreadthDivAlertWhenParentBuyAndWeakSubSectorBreadth() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBreadthDiv();
    when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(enabled("sub_sector_breadth_divergence", Severity.WARNING)));
    // TECH has an active BUY trade signal
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("sub_sector_breadth_divergence", "TECH"))
        .thenReturn(false);
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    // Only SEMI is in Leading quadrant (1/4 = 25% < 40% threshold)
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("4"),
                "SEMI", new BigDecimal("4"),
                "AIRO", new BigDecimal("1"),
                "CLOD", new BigDecimal("2"),
                "SOFT", new BigDecimal("1")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("sub_sector_breadth_divergence")
                        && a.categoryId() == CategoryId.TECH
                        && a.severity() == Severity.WARNING
                        && a.message().contains("TECH")
                        && a.message().contains("BUY")));
  }

  @Test
  @DisplayName("sub_sector_breadth_divergence: no alert when parent has no active BUY trade signal")
  void shouldNotCreateSubSectorBreadthDivAlertWhenParentHasNoBuySignal() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBreadthDiv();
    when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(enabled("sub_sector_breadth_divergence", Severity.WARNING)));
    // TECH has NO active BUY trade signal
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("sub_sector_breadth_divergence", "TECH"))
        .thenReturn(false);
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("4"),
                "SEMI", new BigDecimal("4"),
                "AIRO", new BigDecimal("1"),
                "CLOD", new BigDecimal("1"),
                "SOFT", new BigDecimal("2")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_breadth_divergence")));
  }

  @Test
  @DisplayName("sub_sector_breadth_divergence: no alert when rule is disabled")
  void shouldNotCreateSubSectorBreadthDivAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBreadthDiv();
    // rule stays disabled

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_breadth_divergence")));
  }

  @Test
  @DisplayName(
      "sub_sector_breadth_divergence: no alert when sub-sector breadth is >=40% (sufficient confirmation)")
  void shouldNotCreateSubSectorBreadthDivAlertWhenBreadthSufficient() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBreadthDiv();
    when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(enabled("sub_sector_breadth_divergence", Severity.WARNING)));
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(true);
    when(alertRepository.existsActiveAlert("sub_sector_breadth_divergence", "TECH"))
        .thenReturn(false);
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    // 2 of 4 sub-sectors bullish = 50% >= 40% threshold
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "TECH", new BigDecimal("4"),
                "SEMI", new BigDecimal("4"),
                "AIRO", new BigDecimal("3"),
                "CLOD", new BigDecimal("1"),
                "SOFT", new BigDecimal("2")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_breadth_divergence")));
  }

  @Test
  @DisplayName("sub_sector_breadth_divergence: resolves when parent BUY signal is gone")
  void shouldResolveSubSectorBreadthDivWhenParentBuySignalGone() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBreadthDiv();
    when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(enabled("sub_sector_breadth_divergence", Severity.WARNING)));
    when(alertRepository.existsActiveAlert("trade_signal_buy", "TECH")).thenReturn(false);
    when(alertRepository.existsActiveAlert("sub_sector_breadth_divergence", "TECH"))
        .thenReturn(true); // was active
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "SEMI", new BigDecimal("1"),
                "AIRO", new BigDecimal("2"),
                "CLOD", new BigDecimal("1"),
                "SOFT", new BigDecimal("2")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("sub_sector_breadth_divergence", "TECH");
    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_breadth_divergence")));
  }

  // ===== Sub-Sector Bull Confluence Alert Tests =====

  private void stubAllRulesDisabledExceptSubSectorBullConfluence() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(alertRulesRepository.findById("cross_horizon_rs_divergence"))
        .thenReturn(Optional.of(disabled("cross_horizon_rs_divergence")));
    when(alertRulesRepository.findById("macro_sector_mismatch"))
        .thenReturn(Optional.of(disabled("macro_sector_mismatch")));
    when(alertRulesRepository.findById("sub_sector_breadth_divergence"))
        .thenReturn(Optional.of(disabled("sub_sector_breadth_divergence")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName(
      "sub_sector_bull_confluence: fires INFO when >=75% of sub-sectors are in Leading/Improving RRG")
  void shouldCreateSubSectorBullConfluenceAlertWhenBroadBullishBreadth() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBullConfluence();
    when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(enabled("sub_sector_bull_confluence", Severity.INFO)));
    when(alertRepository.existsActiveAlert("sub_sector_bull_confluence", "TECH")).thenReturn(false);
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    // 3 of 4 sub-sectors bullish (75%) — meets threshold
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "SEMI", new BigDecimal("4"),
                "AIRO", new BigDecimal("3"),
                "CLOD", new BigDecimal("4"),
                "SOFT", new BigDecimal("1")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository)
        .insert(
            argThat(
                a ->
                    a.ruleId().equals("sub_sector_bull_confluence")
                        && a.severity() == Severity.INFO
                        && a.categoryId() == CategoryId.TECH));
  }

  @Test
  @DisplayName("sub_sector_bull_confluence: no alert when breadth is below 75%")
  void shouldNotCreateSubSectorBullConfluenceAlertWhenBreadthInsufficient() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBullConfluence();
    when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(enabled("sub_sector_bull_confluence", Severity.INFO)));
    when(alertRepository.existsActiveAlert("sub_sector_bull_confluence", "TECH")).thenReturn(false);
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    // 2 of 4 sub-sectors bullish (50%) — below 75% threshold
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "SEMI", new BigDecimal("4"),
                "AIRO", new BigDecimal("1"),
                "CLOD", new BigDecimal("3"),
                "SOFT", new BigDecimal("2")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_bull_confluence")));
  }

  @Test
  @DisplayName("sub_sector_bull_confluence: no alert when rule is disabled")
  void shouldNotCreateSubSectorBullConfluenceAlertWhenRuleDisabled() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBullConfluence();
    when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(disabled("sub_sector_bull_confluence")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_bull_confluence")));
  }

  @Test
  @DisplayName("sub_sector_bull_confluence: resolves when breadth drops below 55%")
  void shouldResolveSubSectorBullConfluenceWhenBreadthDrops() {
    stubTopLevelCategories("TECH");
    stubAllRulesDisabledExceptSubSectorBullConfluence();
    when(alertRulesRepository.findById("sub_sector_bull_confluence"))
        .thenReturn(Optional.of(enabled("sub_sector_bull_confluence", Severity.INFO)));
    when(alertRepository.existsActiveAlert("sub_sector_bull_confluence", "TECH")).thenReturn(true);
    when(categoryRepository.findSubCategoriesByParentId("TECH")).thenReturn(techSubSectors());
    // 1 of 4 bullish (25%) — below 55% resolve threshold
    when(signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, DATE))
        .thenReturn(
            Map.of(
                "SEMI", new BigDecimal("4"),
                "AIRO", new BigDecimal("1"),
                "CLOD", new BigDecimal("2"),
                "SOFT", new BigDecimal("1")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository).resolveAlertsByRuleAndCategory("sub_sector_bull_confluence", "TECH");
    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("sub_sector_bull_confluence")));
  }

  // ===== Theme Momentum Alert Tests =====

  private void stubAllRulesDisabledExceptThemeMomentum() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("theme_momentum_surge: fires ACTION alert when avg 20d trend exceeds +0.010")
  void shouldCreateThemeMomentumSurgeAlertWhenAvgTrendExceedsThreshold() {
    stubAllRulesDisabledExceptThemeMomentum();
    when(alertRulesRepository.findById("theme_momentum_surge"))
        .thenReturn(Optional.of(enabled("theme_momentum_surge", Severity.ACTION)));
    when(alertRulesRepository.findById("theme_momentum_collapse"))
        .thenReturn(Optional.of(disabled("theme_momentum_collapse")));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("TECH", "SEMI")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.015"), "SEMI", new BigDecimal("0.012")));
    when(alertRepository.existsActiveAlertForTheme("theme_momentum_surge", "AI_INFRA"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("theme_momentum_surge");
    assertThat(inserted.themeId()).isEqualTo("AI_INFRA");
    assertThat(inserted.severity()).isEqualTo(Severity.ACTION);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("AI_INFRA").containsIgnoringCase("surging");
  }

  @Test
  @DisplayName("theme_momentum_surge: no alert when rule is disabled")
  void shouldNotCreateThemeMomentumSurgeAlertWhenRuleDisabled() {
    stubAllRulesDisabledExceptThemeMomentum();
    when(alertRulesRepository.findById("theme_momentum_surge"))
        .thenReturn(Optional.of(disabled("theme_momentum_surge")));
    when(alertRulesRepository.findById("theme_momentum_collapse"))
        .thenReturn(Optional.of(disabled("theme_momentum_collapse")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("theme_momentum_surge")));
  }

  @Test
  @DisplayName("theme_momentum_collapse: fires WARNING alert when avg 20d trend drops below -0.010")
  void shouldCreateThemeMomentumCollapseAlertWhenAvgTrendDropsBelowThreshold() {
    stubAllRulesDisabledExceptThemeMomentum();
    when(alertRulesRepository.findById("theme_momentum_surge"))
        .thenReturn(Optional.of(disabled("theme_momentum_surge")));
    when(alertRulesRepository.findById("theme_momentum_collapse"))
        .thenReturn(Optional.of(enabled("theme_momentum_collapse", Severity.WARNING)));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("SAAS_AT_RISK", List.of("WCLD", "IGV")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("WCLD", new BigDecimal("-0.015"), "IGV", new BigDecimal("-0.012")));
    when(alertRepository.existsActiveAlertForTheme("theme_momentum_collapse", "SAAS_AT_RISK"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("theme_momentum_collapse");
    assertThat(inserted.themeId()).isEqualTo("SAAS_AT_RISK");
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("SAAS_AT_RISK").containsIgnoringCase("collaps");
  }

  @Test
  @DisplayName("theme_momentum_collapse: no alert when rule is disabled")
  void shouldNotCreateThemeMomentumCollapseAlertWhenRuleDisabled() {
    stubAllRulesDisabledExceptThemeMomentum();
    when(alertRulesRepository.findById("theme_momentum_surge"))
        .thenReturn(Optional.of(disabled("theme_momentum_surge")));
    when(alertRulesRepository.findById("theme_momentum_collapse"))
        .thenReturn(Optional.of(disabled("theme_momentum_collapse")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("theme_momentum_collapse")));
  }

  // ===== Theme Distribute Warning Alert Tests =====

  private void stubAllRulesDisabledExceptThemeDistribute() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("theme_distribute_warning: fires WARNING when score >=0.65 and flow <=-0.5")
  void shouldCreateThemeDistributeWarningWhenHighScoreLowFlow() {
    stubAllRulesDisabledExceptThemeDistribute();
    when(alertRulesRepository.findById("theme_distribute_warning"))
        .thenReturn(Optional.of(enabled("theme_distribute_warning", Severity.WARNING)));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("CHIP_COMPUTE", List.of("SOXX", "SMH")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("SOXX", new BigDecimal("0.70"), "SMH", new BigDecimal("0.72")));
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("SOXX", new BigDecimal("-0.60"), "SMH", new BigDecimal("-0.75")));
    when(alertRepository.existsActiveAlertForTheme("theme_distribute_warning", "CHIP_COMPUTE"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("theme_distribute_warning");
    assertThat(inserted.themeId()).isEqualTo("CHIP_COMPUTE");
    assertThat(inserted.severity()).isEqualTo(Severity.WARNING);
  }

  @Test
  @DisplayName("theme_distribute_warning: no alert when score is below BUY threshold")
  void shouldNotCreateThemeDistributeWarningWhenScoreBelowBuyThreshold() {
    stubAllRulesDisabledExceptThemeDistribute();
    when(alertRulesRepository.findById("theme_distribute_warning"))
        .thenReturn(Optional.of(enabled("theme_distribute_warning", Severity.WARNING)));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("SAAS_AT_RISK", List.of("WCLD", "IGV")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("WCLD", new BigDecimal("0.55"), "IGV", new BigDecimal("0.58")));
    when(signalRepository.findByTypeAndDate(SignalType.FLOW_20D, DATE))
        .thenReturn(Map.of("WCLD", new BigDecimal("-0.70"), "IGV", new BigDecimal("-0.80")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("theme_distribute_warning")));
  }

  @Test
  @DisplayName("theme_distribute_warning: no alert when rule is disabled")
  void shouldNotCreateThemeDistributeWarningWhenRuleDisabled() {
    stubAllRulesDisabledExceptThemeDistribute();
    when(alertRulesRepository.findById("theme_distribute_warning"))
        .thenReturn(Optional.of(disabled("theme_distribute_warning")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("theme_distribute_warning")));
  }

  // ===== Theme Phase Breakout Entry Alert Tests =====

  private static final LocalDate PRIOR_DATE_1 = DATE.minusDays(1);
  private static final LocalDate PRIOR_DATE_2 = DATE.minusDays(2);
  private static final LocalDate PRIOR_DATE_3 = DATE.minusDays(3);
  private static final LocalDate PRIOR_DATE_4 = DATE.minusDays(4);
  private static final LocalDate PRIOR_DATE_5 = DATE.minusDays(5);

  private void stubAllRulesDisabledExceptThemePhaseBreakout() {
    stubAllOtherRulesDisabled();
    when(alertRulesRepository.findById("flow_surge"))
        .thenReturn(Optional.of(disabled("flow_surge")));
    when(alertRulesRepository.findById("rs_aligned_bull"))
        .thenReturn(Optional.of(disabled("rs_aligned_bull")));
    when(alertRulesRepository.findById("rs_aligned_bear"))
        .thenReturn(Optional.of(disabled("rs_aligned_bear")));
    when(alertRulesRepository.findById("pre_buy_flow_surge"))
        .thenReturn(Optional.of(disabled("pre_buy_flow_surge")));
    when(alertRulesRepository.findById("rrg_rs_divergence"))
        .thenReturn(Optional.of(disabled("rrg_rs_divergence")));
    when(alertRulesRepository.findById("score_percentile_extreme"))
        .thenReturn(Optional.of(disabled("score_percentile_extreme")));
    when(alertRulesRepository.findById("score_velocity"))
        .thenReturn(Optional.of(disabled("score_velocity")));
    when(rotationEventRepository.findRecentEvents(DATE)).thenReturn(List.of());
  }

  @Test
  @DisplayName("theme_phase_breakout_entry: fires ACTION when theme enters BREAKOUT from SETUP")
  void shouldCreateThemePhaseBreakoutEntryAlertWhenTransitionFromSetup() {
    stubAllRulesDisabledExceptThemePhaseBreakout();
    when(alertRulesRepository.findById("theme_phase_breakout_entry"))
        .thenReturn(Optional.of(enabled("theme_phase_breakout_entry", Severity.ACTION)));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("TECH", "SEMI")));
    // Current signals: score 0.70 avg, trend5d 0.015, trend20d 0.004 → BREAKOUT (accel = 0.011)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.68"), "SEMI", new BigDecimal("0.72")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.015"), "SEMI", new BigDecimal("0.015")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.004"), "SEMI", new BigDecimal("0.004")));
    when(alertRepository.existsActiveAlertForTheme("theme_phase_breakout_entry", "AI_INFRA"))
        .thenReturn(false);
    // 5-step prior date chain
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, DATE)).thenReturn(PRIOR_DATE_1);
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, PRIOR_DATE_1)).thenReturn(PRIOR_DATE_2);
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, PRIOR_DATE_2)).thenReturn(PRIOR_DATE_3);
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, PRIOR_DATE_3)).thenReturn(PRIOR_DATE_4);
    when(signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, PRIOR_DATE_4)).thenReturn(PRIOR_DATE_5);
    // Prior signals: score 0.60, trend5d 0.006, trend20d 0.008 → SETUP (accel = -0.002 < 0.005)
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, PRIOR_DATE_5))
        .thenReturn(Map.of("TECH", new BigDecimal("0.60"), "SEMI", new BigDecimal("0.60")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, PRIOR_DATE_5))
        .thenReturn(Map.of("TECH", new BigDecimal("0.006"), "SEMI", new BigDecimal("0.006")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, PRIOR_DATE_5))
        .thenReturn(Map.of("TECH", new BigDecimal("0.008"), "SEMI", new BigDecimal("0.008")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    ArgumentCaptor<Alert> captor = ArgumentCaptor.forClass(Alert.class);
    verify(alertRepository).insert(captor.capture());
    Alert inserted = captor.getValue();
    assertThat(inserted.ruleId()).isEqualTo("theme_phase_breakout_entry");
    assertThat(inserted.themeId()).isEqualTo("AI_INFRA");
    assertThat(inserted.severity()).isEqualTo(Severity.ACTION);
    assertThat(inserted.status()).isEqualTo(AlertStatus.ACTIVE);
    assertThat(inserted.message()).contains("AI_INFRA").containsIgnoringCase("BREAKOUT");
  }

  @Test
  @DisplayName("theme_phase_breakout_entry: no alert when score below BREAKOUT threshold")
  void shouldNotCreateThemePhaseBreakoutEntryWhenScoreBelowBreakoutThreshold() {
    stubAllRulesDisabledExceptThemePhaseBreakout();
    when(alertRulesRepository.findById("theme_phase_breakout_entry"))
        .thenReturn(Optional.of(enabled("theme_phase_breakout_entry", Severity.ACTION)));
    when(themeRepository.findAllConstituentsByTheme())
        .thenReturn(Map.of("AI_INFRA", List.of("TECH", "SEMI")));
    // Score 0.60 < 0.65 → phase is SETUP not BREAKOUT, so no prior date query needed
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.60"), "SEMI", new BigDecimal("0.60")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.015"), "SEMI", new BigDecimal("0.015")));
    when(signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, DATE))
        .thenReturn(Map.of("TECH", new BigDecimal("0.004"), "SEMI", new BigDecimal("0.004")));
    when(alertRepository.existsActiveAlertForTheme("theme_phase_breakout_entry", "AI_INFRA"))
        .thenReturn(false);

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("theme_phase_breakout_entry")));
  }

  @Test
  @DisplayName("theme_phase_breakout_entry: no alert when rule is disabled")
  void shouldNotCreateThemePhaseBreakoutEntryWhenRuleDisabled() {
    stubAllRulesDisabledExceptThemePhaseBreakout();
    when(alertRulesRepository.findById("theme_phase_breakout_entry"))
        .thenReturn(Optional.of(disabled("theme_phase_breakout_entry")));

    engine.onSignalsUpdated(new SignalsUpdatedEvent(DATE));

    verify(alertRepository, never())
        .insert(argThat(a -> a.ruleId().equals("theme_phase_breakout_entry")));
  }
}

package com.ftm.app.alerts.service;

import com.ftm.app.alerts.evaluator.AlertEvaluationContext;
import com.ftm.app.alerts.evaluator.ThemePhaseBreakoutEntryAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemePhaseFadingAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeRecoverySignalAlertEvaluator;
import com.ftm.app.alerts.evaluator.BreadthVelocityAlertEvaluator;
import com.ftm.app.alerts.evaluator.CrossHorizonRsDivergenceAlertEvaluator;
import com.ftm.app.alerts.evaluator.HighConvictionAlertEvaluator;
import com.ftm.app.alerts.evaluator.MacroRegimeShiftAlertEvaluator;
import com.ftm.app.alerts.evaluator.MacroSectorMismatchAlertEvaluator;
import com.ftm.app.alerts.evaluator.PersistenceLowAlertEvaluator;
import com.ftm.app.alerts.evaluator.PreBuyFlowSurgeAlertEvaluator;
import com.ftm.app.alerts.evaluator.RrgRsDivergenceAlertEvaluator;
import com.ftm.app.alerts.evaluator.RsAccelerationCrossoverAlertEvaluator;
import com.ftm.app.alerts.evaluator.RsAlignedAlertEvaluator;
import com.ftm.app.alerts.evaluator.RsBreadthExtremeAlertEvaluator;
import com.ftm.app.alerts.evaluator.ScoreApproachingSignalEvaluator;
import com.ftm.app.alerts.evaluator.SubSectorBreadthAlertEvaluator;
import com.ftm.app.alerts.evaluator.TradeSignalTransitionsAlertEvaluator;
import com.ftm.app.alerts.evaluator.ScorePercentileExtremeAlertEvaluator;
import com.ftm.app.alerts.evaluator.ScoreVelocityAlertEvaluator;
import com.ftm.app.alerts.evaluator.SignalDeteriorationAlertEvaluator;
import com.ftm.app.alerts.evaluator.Theme5dAccelerationAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeDistributeWarningAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeFailedBreakoutAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeMomentumAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeMomentumExhaustionAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemePeerDivergenceAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeScorePriceDivergenceAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeSetupAccelerationAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeSignalTransitionsAlertEvaluator;
import com.ftm.app.alerts.evaluator.ThemeStrongBreakoutAlertEvaluator;
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
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Evaluates alert rules after each signal computation run.
 *
 * <p>Implemented rules: - rrg_transition: one alert per ENTERING_IMPROVING or ENTERING_LEADING
 * rotation event - composite_breakout: one alert per COMPOSITE_BREAKOUT rotation event -
 * macro_regime_shift: fires when MACRO_REGIME signal changes from the previous signal date
 *
 * <p>Flow alerts: - flow_surge: fires when FLOW_20D z-score crosses above 2.0σ (institutional
 * inflow spike, detected via FLOW_SURGE rotation event)
 */
@Service
public class AlertRulesEngine {

  private static final Logger log = LoggerFactory.getLogger(AlertRulesEngine.class);

  private static final String RULE_RRG_TRANSITION = "rrg_transition";
  private static final String RULE_COMPOSITE_BREAKOUT = "composite_breakout";
  private static final String RULE_COMPOSITE_BREAKDOWN = "composite_breakdown";
  private static final String RULE_PERSISTENCE_LOW = "persistence_low";
  private static final String RULE_BREADTH_VELOCITY_ACCEL = "breadth_velocity_accel";
  private static final String RULE_BREADTH_VELOCITY_DECEL = "breadth_velocity_decel";
  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";
  private static final String RULE_TRADE_SIGNAL_REDUCE = "trade_signal_reduce";
  private static final String RULE_SCORE_APPROACHING_BUY = "score_approaching_buy";
  private static final String RULE_SCORE_APPROACHING_REDUCE = "score_approaching_reduce";
  private static final String RULE_SIGNAL_DETERIORATION = "signal_deterioration";
  private static final String RULE_FLOW_SURGE = "flow_surge";
  private static final String RULE_RS_ALIGNED_BULL = "rs_aligned_bull";
  private static final String RULE_RS_ALIGNED_BEAR = "rs_aligned_bear";
  private static final String RULE_PRE_BUY_FLOW_SURGE = "pre_buy_flow_surge";
  private static final String RULE_MULTI_ALERT_BULL = "multi_alert_bull_confluence";
  private static final int BULL_CONFLUENCE_THRESHOLD = 3;
  private static final List<String> BULL_ALERT_RULES =
      List.of(
          "trade_signal_buy",
          "high_conviction_buy",
          "score_approaching_buy",
          "pre_buy_flow_surge",
          "rs_aligned_bull",
          "breadth_velocity_accel",
          "composite_breakout");
  private static final BigDecimal FLOW_SURGE_Z_THRESHOLD = new BigDecimal("2.0");
  private static final BigDecimal FLOW_SURGE_RESOLVE_THRESHOLD = new BigDecimal("1.0");
  private static final BigDecimal PRE_BUY_FLOW_SURGE_RESOLVE_Z = new BigDecimal("0.8");
  private static final BigDecimal DETERIORATION_RECOVERY_THRESHOLD = new BigDecimal("-0.02");
  private static final BigDecimal APPROACHING_BUY_LOWER = new BigDecimal("0.55");
  private static final BigDecimal PERSISTENCE_RECOVERY_THRESHOLD = new BigDecimal("8");
  private static final int BREADTH_VELOCITY_THRESHOLD_PP = 10;
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");
  private static final String RULE_THEME_PHASE_BREAKOUT_ENTRY = "theme_phase_breakout_entry";
  // Fires when a theme transitions INTO the BREAKOUT phase (was not BREAKOUT 5 trading days ago)
  private static final int THEME_PHASE_LOOKBACK_DAYS = 5;
  private static final String RULE_THEME_PHASE_FADING = "theme_phase_fading";
  // Fires when a theme transitions INTO FADING phase (was not FADING N trading days ago, now is).
  // Resolves when phase exits FADING (score recovers above 0.55 or trend turns positive).
  private static final double THEME_FADING_RESOLVE_SCORE = 0.55;
  private static final String RULE_THEME_RECOVERY_SIGNAL = "theme_recovery_signal";
  // Fires when a FADING/WEAK theme shows recovery: score in 35-55, 5d trend turns positive (>0.003)
  // while 20d was still negative 5 days ago — confirms nascent recovery before full phase shift.
  // Resolves when score rises above 0.60 (recovered) or drops below 0.30 (failed).
  private static final double THEME_RECOVERY_SCORE_MIN = 0.35;
  private static final double THEME_RECOVERY_SCORE_MAX = 0.55;
  private static final double THEME_RECOVERY_5D_MIN = 0.003;
  private static final double THEME_RECOVERY_PRIOR_20D_MAX = -0.001;
  private static final double THEME_RECOVERY_RESOLVE_SCORE_HIGH = 0.60;
  private static final double THEME_RECOVERY_RESOLVE_SCORE_LOW = 0.30;

  private final AlertRepository alertRepository;
  private final AlertRulesRepository alertRulesRepository;
  private final RotationEventRepository rotationEventRepository;
  private final SignalRepository signalRepository;
  private final CategoryRepository categoryRepository;
  private final ThemeRepository themeRepository;

  // Rules being migrated out of this class into their own AlertEvaluator components (see the
  // clean-code refactoring plan). The engine still orchestrates; each extracted rule is one class.
  private final MacroRegimeShiftAlertEvaluator macroRegimeShiftAlertEvaluator;
  private final ThemeMomentumAlertEvaluator themeMomentumAlertEvaluator;
  private final Theme5dAccelerationAlertEvaluator theme5dAccelerationAlertEvaluator;
  private final ThemeDistributeWarningAlertEvaluator themeDistributeWarningAlertEvaluator;
  private final ThemePeerDivergenceAlertEvaluator themePeerDivergenceAlertEvaluator;
  private final ThemeScorePriceDivergenceAlertEvaluator themeScorePriceDivergenceAlertEvaluator;
  private final ThemeStrongBreakoutAlertEvaluator themeStrongBreakoutAlertEvaluator;
  private final ThemeMomentumExhaustionAlertEvaluator themeMomentumExhaustionAlertEvaluator;
  private final ThemeSignalTransitionsAlertEvaluator themeSignalTransitionsAlertEvaluator;
  private final ThemeSetupAccelerationAlertEvaluator themeSetupAccelerationAlertEvaluator;
  private final ThemeFailedBreakoutAlertEvaluator themeFailedBreakoutAlertEvaluator;
  private final ScorePercentileExtremeAlertEvaluator scorePercentileExtremeAlertEvaluator;
  private final ScoreVelocityAlertEvaluator scoreVelocityAlertEvaluator;
  private final SignalDeteriorationAlertEvaluator signalDeteriorationAlertEvaluator;
  private final RsBreadthExtremeAlertEvaluator rsBreadthExtremeAlertEvaluator;
  private final PersistenceLowAlertEvaluator persistenceLowAlertEvaluator;
  private final BreadthVelocityAlertEvaluator breadthVelocityAlertEvaluator;
  private final RsAlignedAlertEvaluator rsAlignedAlertEvaluator;
  private final ScoreApproachingSignalEvaluator scoreApproachingSignalEvaluator;
  private final HighConvictionAlertEvaluator highConvictionAlertEvaluator;
  private final RsAccelerationCrossoverAlertEvaluator rsAccelerationCrossoverAlertEvaluator;
  private final PreBuyFlowSurgeAlertEvaluator preBuyFlowSurgeAlertEvaluator;
  private final RrgRsDivergenceAlertEvaluator rrgRsDivergenceAlertEvaluator;
  private final TradeSignalTransitionsAlertEvaluator tradeSignalTransitionsAlertEvaluator;
  private final CrossHorizonRsDivergenceAlertEvaluator crossHorizonRsDivergenceAlertEvaluator;
  private final MacroSectorMismatchAlertEvaluator macroSectorMismatchAlertEvaluator;
  private final SubSectorBreadthAlertEvaluator subSectorBreadthAlertEvaluator;
  private final ThemePhaseBreakoutEntryAlertEvaluator themePhaseBreakoutEntryAlertEvaluator;
  private final ThemePhaseFadingAlertEvaluator themePhaseFadingAlertEvaluator;
  private final ThemeRecoverySignalAlertEvaluator themeRecoverySignalAlertEvaluator;

  public AlertRulesEngine(
      AlertRepository alertRepository,
      AlertRulesRepository alertRulesRepository,
      RotationEventRepository rotationEventRepository,
      SignalRepository signalRepository,
      CategoryRepository categoryRepository,
      ThemeRepository themeRepository,
      MacroRegimeShiftAlertEvaluator macroRegimeShiftAlertEvaluator,
      ThemeMomentumAlertEvaluator themeMomentumAlertEvaluator,
      Theme5dAccelerationAlertEvaluator theme5dAccelerationAlertEvaluator,
      ThemeDistributeWarningAlertEvaluator themeDistributeWarningAlertEvaluator,
      ThemePeerDivergenceAlertEvaluator themePeerDivergenceAlertEvaluator,
      ThemeScorePriceDivergenceAlertEvaluator themeScorePriceDivergenceAlertEvaluator,
      ThemeStrongBreakoutAlertEvaluator themeStrongBreakoutAlertEvaluator,
      ThemeMomentumExhaustionAlertEvaluator themeMomentumExhaustionAlertEvaluator,
      ThemeSignalTransitionsAlertEvaluator themeSignalTransitionsAlertEvaluator,
      ThemeSetupAccelerationAlertEvaluator themeSetupAccelerationAlertEvaluator,
      ThemeFailedBreakoutAlertEvaluator themeFailedBreakoutAlertEvaluator,
      ScorePercentileExtremeAlertEvaluator scorePercentileExtremeAlertEvaluator,
      ScoreVelocityAlertEvaluator scoreVelocityAlertEvaluator,
      SignalDeteriorationAlertEvaluator signalDeteriorationAlertEvaluator,
      RsBreadthExtremeAlertEvaluator rsBreadthExtremeAlertEvaluator,
      PersistenceLowAlertEvaluator persistenceLowAlertEvaluator,
      BreadthVelocityAlertEvaluator breadthVelocityAlertEvaluator,
      RsAlignedAlertEvaluator rsAlignedAlertEvaluator,
      ScoreApproachingSignalEvaluator scoreApproachingSignalEvaluator,
      HighConvictionAlertEvaluator highConvictionAlertEvaluator,
      RsAccelerationCrossoverAlertEvaluator rsAccelerationCrossoverAlertEvaluator,
      PreBuyFlowSurgeAlertEvaluator preBuyFlowSurgeAlertEvaluator,
      RrgRsDivergenceAlertEvaluator rrgRsDivergenceAlertEvaluator,
      TradeSignalTransitionsAlertEvaluator tradeSignalTransitionsAlertEvaluator,
      CrossHorizonRsDivergenceAlertEvaluator crossHorizonRsDivergenceAlertEvaluator,
      MacroSectorMismatchAlertEvaluator macroSectorMismatchAlertEvaluator,
      SubSectorBreadthAlertEvaluator subSectorBreadthAlertEvaluator,
      ThemePhaseBreakoutEntryAlertEvaluator themePhaseBreakoutEntryAlertEvaluator,
      ThemePhaseFadingAlertEvaluator themePhaseFadingAlertEvaluator,
      ThemeRecoverySignalAlertEvaluator themeRecoverySignalAlertEvaluator) {
    this.alertRepository = alertRepository;
    this.alertRulesRepository = alertRulesRepository;
    this.rotationEventRepository = rotationEventRepository;
    this.signalRepository = signalRepository;
    this.categoryRepository = categoryRepository;
    this.themeRepository = themeRepository;
    this.macroRegimeShiftAlertEvaluator = macroRegimeShiftAlertEvaluator;
    this.themeMomentumAlertEvaluator = themeMomentumAlertEvaluator;
    this.theme5dAccelerationAlertEvaluator = theme5dAccelerationAlertEvaluator;
    this.themeDistributeWarningAlertEvaluator = themeDistributeWarningAlertEvaluator;
    this.themePeerDivergenceAlertEvaluator = themePeerDivergenceAlertEvaluator;
    this.themeScorePriceDivergenceAlertEvaluator = themeScorePriceDivergenceAlertEvaluator;
    this.themeStrongBreakoutAlertEvaluator = themeStrongBreakoutAlertEvaluator;
    this.themeMomentumExhaustionAlertEvaluator = themeMomentumExhaustionAlertEvaluator;
    this.themeSignalTransitionsAlertEvaluator = themeSignalTransitionsAlertEvaluator;
    this.themeSetupAccelerationAlertEvaluator = themeSetupAccelerationAlertEvaluator;
    this.themeFailedBreakoutAlertEvaluator = themeFailedBreakoutAlertEvaluator;
    this.scorePercentileExtremeAlertEvaluator = scorePercentileExtremeAlertEvaluator;
    this.scoreVelocityAlertEvaluator = scoreVelocityAlertEvaluator;
    this.signalDeteriorationAlertEvaluator = signalDeteriorationAlertEvaluator;
    this.rsBreadthExtremeAlertEvaluator = rsBreadthExtremeAlertEvaluator;
    this.persistenceLowAlertEvaluator = persistenceLowAlertEvaluator;
    this.breadthVelocityAlertEvaluator = breadthVelocityAlertEvaluator;
    this.rsAlignedAlertEvaluator = rsAlignedAlertEvaluator;
    this.scoreApproachingSignalEvaluator = scoreApproachingSignalEvaluator;
    this.highConvictionAlertEvaluator = highConvictionAlertEvaluator;
    this.rsAccelerationCrossoverAlertEvaluator = rsAccelerationCrossoverAlertEvaluator;
    this.preBuyFlowSurgeAlertEvaluator = preBuyFlowSurgeAlertEvaluator;
    this.rrgRsDivergenceAlertEvaluator = rrgRsDivergenceAlertEvaluator;
    this.tradeSignalTransitionsAlertEvaluator = tradeSignalTransitionsAlertEvaluator;
    this.crossHorizonRsDivergenceAlertEvaluator = crossHorizonRsDivergenceAlertEvaluator;
    this.macroSectorMismatchAlertEvaluator = macroSectorMismatchAlertEvaluator;
    this.subSectorBreadthAlertEvaluator = subSectorBreadthAlertEvaluator;
    this.themePhaseBreakoutEntryAlertEvaluator = themePhaseBreakoutEntryAlertEvaluator;
    this.themePhaseFadingAlertEvaluator = themePhaseFadingAlertEvaluator;
    this.themeRecoverySignalAlertEvaluator = themeRecoverySignalAlertEvaluator;
  }

  @EventListener
  @Async("asyncExecutor")
  public void onSignalsUpdated(SignalsUpdatedEvent event) {
    LocalDate signalDate = event.signalDate();
    log.info("Evaluating alert rules for signal_date={}", signalDate);

    Set<String> topLevelCategoryIds = categoryRepository.findTopLevelActiveCategoryIds();
    Set<String> equityCategoryIds =
        categoryRepository.findTopLevelActiveCategoryIdsByType(CategoryType.EQUITY_SECTOR);

    int alertsResolved = resolveStaleAlerts(signalDate, topLevelCategoryIds);

    AlertEvaluationContext context =
        new AlertEvaluationContext(signalDate, topLevelCategoryIds, equityCategoryIds);

    int alertsCreated = 0;
    alertsCreated += evaluateRotationEventAlerts(signalDate);
    alertsCreated += macroRegimeShiftAlertEvaluator.evaluate(context);
    alertsCreated += rsAccelerationCrossoverAlertEvaluator.evaluate(context);
    alertsCreated += persistenceLowAlertEvaluator.evaluate(context);
    alertsCreated += breadthVelocityAlertEvaluator.evaluate(context);
    alertsCreated += tradeSignalTransitionsAlertEvaluator.evaluate(context);
    alertsCreated += scoreApproachingSignalEvaluator.evaluate(context);
    alertsCreated += highConvictionAlertEvaluator.evaluate(context);
    alertsCreated += signalDeteriorationAlertEvaluator.evaluate(context);
    alertsCreated += rsAlignedAlertEvaluator.evaluate(context);
    alertsCreated += preBuyFlowSurgeAlertEvaluator.evaluate(context);
    alertsCreated += rsBreadthExtremeAlertEvaluator.evaluate(context);
    alertsCreated += rrgRsDivergenceAlertEvaluator.evaluate(context);
    alertsCreated += scorePercentileExtremeAlertEvaluator.evaluate(context);
    alertsCreated += scoreVelocityAlertEvaluator.evaluate(context);
    alertsCreated += crossHorizonRsDivergenceAlertEvaluator.evaluate(context);
    alertsCreated += macroSectorMismatchAlertEvaluator.evaluate(context);
    alertsCreated += subSectorBreadthAlertEvaluator.evaluate(context);
    alertsCreated += themeSignalTransitionsAlertEvaluator.evaluate(context);
    alertsCreated += themeMomentumAlertEvaluator.evaluate(context);
    alertsCreated += theme5dAccelerationAlertEvaluator.evaluate(context);
    alertsCreated += themeDistributeWarningAlertEvaluator.evaluate(context);
    alertsCreated += themePhaseBreakoutEntryAlertEvaluator.evaluate(context);
    alertsCreated += themeFailedBreakoutAlertEvaluator.evaluate(context);
    alertsCreated += themeSetupAccelerationAlertEvaluator.evaluate(context);
    alertsCreated += themePhaseFadingAlertEvaluator.evaluate(context);
    alertsCreated += themeMomentumExhaustionAlertEvaluator.evaluate(context);
    alertsCreated += themeRecoverySignalAlertEvaluator.evaluate(context);
    alertsCreated += themeStrongBreakoutAlertEvaluator.evaluate(context);
    alertsCreated += themePeerDivergenceAlertEvaluator.evaluate(context);
    alertsCreated += themeScorePriceDivergenceAlertEvaluator.evaluate(context);
    // Must run last: reads active alerts inserted by earlier evaluators in this cycle
    alertsCreated += evaluateMultiAlertBullConfluence(topLevelCategoryIds);

    log.info(
        "Alert rule evaluation complete: {} created, {} resolved for date={}",
        alertsCreated,
        alertsResolved,
        signalDate);
  }

  private int resolveStaleAlerts(LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Map<String, BigDecimal> currentComposites =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> currentPersistence20d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    Map<String, BigDecimal> currentPersistence5d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, signalDate);
    Map<String, BigDecimal> currentTrend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> currentFlow20d =
        signalRepository.findByTypeAndDate(SignalType.FLOW_20D, signalDate);
    Map<String, BigDecimal> currentRs20 =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> currentRs60 =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);

    int resolved = 0;
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal composite = currentComposites.get(categoryId);
      if (composite != null) {
        // Breakdown alert: condition was score < 0.35; resolve when score recovers to ≥ 0.35
        if (composite.compareTo(new BigDecimal("0.35")) >= 0) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(RULE_COMPOSITE_BREAKDOWN, categoryId);
        }
        // Breakout alert: condition was score > 0.70; resolve when score falls back to ≤ 0.70
        if (composite.compareTo(new BigDecimal("0.70")) <= 0) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(RULE_COMPOSITE_BREAKOUT, categoryId);
        }
      }

      // Trade signal alerts: resolve when conditions no longer hold
      if (composite != null) {
        // BUY alert resolves when composite drops below 0.60 (signal weakening)
        if (composite.compareTo(new BigDecimal("0.60")) < 0) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(RULE_TRADE_SIGNAL_BUY, categoryId);
        }
        // REDUCE alert resolves when composite recovers above 0.40
        if (composite.compareTo(new BigDecimal("0.40")) >= 0) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(RULE_TRADE_SIGNAL_REDUCE, categoryId);
        }
        // Approaching-buy resolves when score drops back below 0.50 (stale) or rises to full BUY
        // zone
        if (composite.compareTo(new BigDecimal("0.50")) < 0
            || composite.compareTo(BUY_SCORE_THRESHOLD) >= 0) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(
                  RULE_SCORE_APPROACHING_BUY, categoryId);
        }
        // Approaching-reduce resolves when score recovers above 0.50 or drops to full REDUCE zone
        if (composite.compareTo(new BigDecimal("0.50")) >= 0
            || composite.compareTo(REDUCE_SCORE_THRESHOLD) < 0) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(
                  RULE_SCORE_APPROACHING_REDUCE, categoryId);
        }
      }

      // Persistence-low alert: resolve when persistence recovers to the moderate band (≥ 8/20d)
      BigDecimal p20 = currentPersistence20d.get(categoryId);
      if (p20 != null && p20.compareTo(PERSISTENCE_RECOVERY_THRESHOLD) >= 0) {
        resolved +=
            alertRepository.resolveAlertsByRuleAndCategory(RULE_PERSISTENCE_LOW, categoryId);
      }

      // Breadth velocity alerts: resolve when velocity retreats inside ±threshold
      BigDecimal p5d = currentPersistence5d.get(categoryId);
      if (p20 != null && p5d != null) {
        double rate5d = p5d.doubleValue() / 5.0;
        double rate15 = (p20.doubleValue() - p5d.doubleValue()) / 15.0;
        int velocityPp = (int) Math.round((rate5d - rate15) * 100);
        if (velocityPp < BREADTH_VELOCITY_THRESHOLD_PP) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(
                  RULE_BREADTH_VELOCITY_ACCEL, categoryId);
        }
        if (velocityPp > -BREADTH_VELOCITY_THRESHOLD_PP) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(
                  RULE_BREADTH_VELOCITY_DECEL, categoryId);
        }
      }

      // Deterioration alert: resolve when score exits BUY territory or trend recovers
      BigDecimal trend5d = currentTrend5d.get(categoryId);
      if (composite != null && trend5d != null) {
        boolean exitedBuyTerritory = composite.compareTo(BUY_SCORE_THRESHOLD) < 0;
        boolean trendRecovered = trend5d.compareTo(DETERIORATION_RECOVERY_THRESHOLD) >= 0;
        if (exitedBuyTerritory || trendRecovered) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(RULE_SIGNAL_DETERIORATION, categoryId);
        }
      }

      // Flow surge alert: resolve when flow z-score drops back below 1.0 (surge dissipated)
      BigDecimal flow20d = currentFlow20d.get(categoryId);
      if (flow20d != null && flow20d.compareTo(FLOW_SURGE_RESOLVE_THRESHOLD) < 0) {
        resolved += alertRepository.resolveAlertsByRuleAndCategory(RULE_FLOW_SURGE, categoryId);
      }

      // RS aligned bull alert: resolve when RS-20 is no longer leading RS-60 (alignment broke)
      BigDecimal rs20 = currentRs20.get(categoryId);
      BigDecimal rs60 = currentRs60.get(categoryId);
      if (rs20 != null && rs60 != null && rs20.compareTo(rs60) <= 0) {
        resolved +=
            alertRepository.resolveAlertsByRuleAndCategory(RULE_RS_ALIGNED_BULL, categoryId);
      }

      // RS aligned bear alert: resolve when RS-20 is no longer below RS-60 (bearish alignment
      // broke)
      if (rs20 != null && rs60 != null && rs20.compareTo(rs60) >= 0) {
        resolved +=
            alertRepository.resolveAlertsByRuleAndCategory(RULE_RS_ALIGNED_BEAR, categoryId);
      }

      // Pre-buy flow surge: resolve when score exits approach zone OR flow drops below 0.8σ
      BigDecimal flow = currentFlow20d.get(categoryId);
      if (composite != null
          && (composite.compareTo(APPROACHING_BUY_LOWER) < 0
              || composite.compareTo(BUY_SCORE_THRESHOLD) >= 0)) {
        resolved +=
            alertRepository.resolveAlertsByRuleAndCategory(RULE_PRE_BUY_FLOW_SURGE, categoryId);
      } else if (flow != null && flow.compareTo(PRE_BUY_FLOW_SURGE_RESOLVE_Z) < 0) {
        resolved +=
            alertRepository.resolveAlertsByRuleAndCategory(RULE_PRE_BUY_FLOW_SURGE, categoryId);
      }
    }

    if (resolved > 0) {
      log.info("Resolved {} stale alert(s) for date={}", resolved, signalDate);
    }
    return resolved;
  }

  private int evaluateRotationEventAlerts(LocalDate signalDate) {
    List<RotationEvent> recentRotationEvents = rotationEventRepository.findRecentEvents(signalDate);
    List<RotationEvent> todaysEvents =
        recentRotationEvents.stream().filter(e -> e.detectedDate().equals(signalDate)).toList();

    Optional<AlertRule> rrgRule = alertRulesRepository.findById(RULE_RRG_TRANSITION);
    Optional<AlertRule> breakoutRule = alertRulesRepository.findById(RULE_COMPOSITE_BREAKOUT);
    Optional<AlertRule> breakdownRule = alertRulesRepository.findById(RULE_COMPOSITE_BREAKDOWN);
    Optional<AlertRule> flowSurgeRule = alertRulesRepository.findById(RULE_FLOW_SURGE);

    boolean rrgRuleEnabled = rrgRule.map(AlertRule::enabled).orElse(false);
    boolean breakoutRuleEnabled = breakoutRule.map(AlertRule::enabled).orElse(false);
    boolean breakdownRuleEnabled = breakdownRule.map(AlertRule::enabled).orElse(false);
    boolean flowSurgeRuleEnabled = flowSurgeRule.map(AlertRule::enabled).orElse(false);
    Severity rrgSeverity = rrgRule.map(AlertRule::severity).orElse(Severity.INFO);
    Severity breakoutSeverity = breakoutRule.map(AlertRule::severity).orElse(Severity.ACTION);
    Severity breakdownSeverity = breakdownRule.map(AlertRule::severity).orElse(Severity.WARNING);
    Severity flowSurgeSeverity = flowSurgeRule.map(AlertRule::severity).orElse(Severity.INFO);

    int count = 0;
    for (RotationEvent rotationEvent : todaysEvents) {
      String categoryId = rotationEvent.categoryId().name();

      if (rrgRuleEnabled && isRrgTransitionEvent(rotationEvent.eventType())) {
        if (!alertRepository.existsActiveAlert(RULE_RRG_TRANSITION, categoryId)) {
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  rotationEvent.categoryId(),
                  RULE_RRG_TRANSITION,
                  rrgSeverity,
                  buildRrgTransitionMessage(rotationEvent),
                  buildRrgSnapshot(rotationEvent),
                  AlertStatus.ACTIVE));
          count++;
        }
      }

      if (breakoutRuleEnabled
          && rotationEvent.eventType() == RotationEventType.COMPOSITE_BREAKOUT) {
        if (!alertRepository.existsActiveAlert(RULE_COMPOSITE_BREAKOUT, categoryId)) {
          int scorePercent = Math.round(rotationEvent.confidence().floatValue() * 100);
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  rotationEvent.categoryId(),
                  RULE_COMPOSITE_BREAKOUT,
                  breakoutSeverity,
                  String.format(
                      "%s composite score reached %d — crossed breakout threshold (70)",
                      categoryId, scorePercent),
                  buildBreakoutSnapshot(rotationEvent),
                  AlertStatus.ACTIVE));
          count++;
        }
      }

      if (breakdownRuleEnabled
          && rotationEvent.eventType() == RotationEventType.COMPOSITE_BREAKDOWN) {
        if (!alertRepository.existsActiveAlert(RULE_COMPOSITE_BREAKDOWN, categoryId)) {
          long scorePercent = Math.round((1.0 - rotationEvent.confidence().doubleValue()) * 100);
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  rotationEvent.categoryId(),
                  RULE_COMPOSITE_BREAKDOWN,
                  breakdownSeverity,
                  String.format(
                      "%s composite score fell to %d — crossed REDUCE threshold (35)",
                      categoryId, scorePercent),
                  buildBreakoutSnapshot(rotationEvent),
                  AlertStatus.ACTIVE));
          count++;
        }
      }

      if (flowSurgeRuleEnabled && rotationEvent.eventType() == RotationEventType.FLOW_SURGE) {
        if (!alertRepository.existsActiveAlert(RULE_FLOW_SURGE, categoryId)) {
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  rotationEvent.categoryId(),
                  RULE_FLOW_SURGE,
                  flowSurgeSeverity,
                  String.format(
                      "%s flow z-score crossed 2σ — unusual institutional inflow activity detected",
                      categoryId),
                  rotationEvent.signalSnapshot(),
                  AlertStatus.ACTIVE));
          count++;
          log.info("flow_surge alert: category={} signalDate={}", categoryId, signalDate);
        }
      }
    }
    return count;
  }

  private boolean isRrgTransitionEvent(RotationEventType eventType) {
    return eventType == RotationEventType.ENTERING_IMPROVING
        || eventType == RotationEventType.ENTERING_LEADING
        || eventType == RotationEventType.ENTERING_WEAKENING
        || eventType == RotationEventType.ENTERING_LAGGING;
  }

  private String buildRrgTransitionMessage(RotationEvent rotationEvent) {
    String transitionDescription =
        switch (rotationEvent.eventType()) {
          case ENTERING_LEADING -> "entered Leading quadrant (Improving → Leading)";
          case ENTERING_WEAKENING ->
              "entered Weakening quadrant (Leading → Weakening) — rotation peak";
          case ENTERING_LAGGING ->
              "entered Lagging quadrant (Weakening → Lagging) — losing relative strength";
          default -> "entered Improving quadrant — strengthening momentum";
        };
    return String.format("%s %s", rotationEvent.categoryId().name(), transitionDescription);
  }

  private String buildRrgSnapshot(RotationEvent rotationEvent) {
    return String.format(
        "{\"eventType\":\"%s\",\"confidence\":%.3f,\"detectedDate\":\"%s\"}",
        rotationEvent.eventType().name(), rotationEvent.confidence(), rotationEvent.detectedDate());
  }

  private String buildBreakoutSnapshot(RotationEvent rotationEvent) {
    return String.format(
        "{\"eventType\":\"%s\",\"confidence\":%.3f,\"detectedDate\":\"%s\"}",
        rotationEvent.eventType().name(), rotationEvent.confidence(), rotationEvent.detectedDate());
  }

  /**
   * Meta-alert: fires when a single sector has &ge; 3 bullish alerts simultaneously active.
   * Multiple concurrent signals indicate high-confidence institutional rotation into a sector — a
   * rare confluence that's more actionable than any individual alert alone.
   *
   * <p>Must run last in {@code onSignalsUpdated} so it sees alerts inserted earlier in the same
   * evaluation cycle (e.g., rs_aligned_bull fired this call is visible here).
   */
  private int evaluateMultiAlertBullConfluence(Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_MULTI_ALERT_BULL);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    int count = 0;
    for (String categoryId : topLevelCategoryIds) {
      List<String> activeRules =
          BULL_ALERT_RULES.stream()
              .filter(r -> alertRepository.existsActiveAlert(r, categoryId))
              .toList();
      boolean hasConfluence = alertRepository.existsActiveAlert(RULE_MULTI_ALERT_BULL, categoryId);

      if (activeRules.size() >= BULL_CONFLUENCE_THRESHOLD && !hasConfluence) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("multi_alert_bull_confluence: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String ruleList = String.join(", ", activeRules);
        String snapshot =
            String.format(
                "{\"activeCount\":%d,\"rules\":\"%s\"}",
                activeRules.size(), String.join(",", activeRules));
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_MULTI_ALERT_BULL,
                severity,
                String.format(
                    "%s: %d bullish signals aligned (%s) — high-confidence rotation setup",
                    categoryId, activeRules.size(), ruleList),
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "multi_alert_bull_confluence: category={} count={} rules=[{}]",
            categoryId,
            activeRules.size(),
            ruleList);
        count++;
      } else if (activeRules.size() < BULL_CONFLUENCE_THRESHOLD && hasConfluence) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_MULTI_ALERT_BULL, categoryId);
        log.info(
            "multi_alert_bull_confluence: resolved for category={} (activeCount={})",
            categoryId,
            activeRules.size());
      }
    }
    return count;
  }

}


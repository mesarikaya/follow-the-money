package com.ftm.app.alerts.service;

import com.ftm.app.alerts.evaluator.AlertEvaluationContext;
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
  private static final String RULE_SUB_SECTOR_BREADTH_DIV = "sub_sector_breadth_divergence";
  // Fires when <40% of sub-sectors are in Leading/Improving RRG while parent has a BUY signal
  private static final double SUB_SECTOR_BREADTH_FIRE_FRACTION = 0.40;
  private static final double SUB_SECTOR_BREADTH_RESOLVE_FRACTION = 0.55;
  private static final int SUB_SECTOR_MIN_COUNT = 2;
  private static final String RULE_SUB_SECTOR_BULL_CONFLUENCE = "sub_sector_bull_confluence";
  private static final String RULE_THEME_PHASE_BREAKOUT_ENTRY = "theme_phase_breakout_entry";
  // Fires when a theme transitions INTO the BREAKOUT phase (was not BREAKOUT 5 trading days ago)
  private static final int THEME_PHASE_LOOKBACK_DAYS = 5;
  // Fires when >=75% of sub-sectors are in Leading/Improving RRG (broad internal participation)
  private static final double SUB_SECTOR_BULL_CONFLUENCE_FIRE_FRACTION = 0.75;
  private static final double SUB_SECTOR_BULL_CONFLUENCE_RESOLVE_FRACTION = 0.55;
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
      MacroSectorMismatchAlertEvaluator macroSectorMismatchAlertEvaluator) {
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
    alertsCreated += evaluateSubSectorBreadthDivergence(signalDate, equityCategoryIds);
    alertsCreated += evaluateSubSectorBullConfluence(signalDate, equityCategoryIds);
    alertsCreated += themeSignalTransitionsAlertEvaluator.evaluate(context);
    alertsCreated += themeMomentumAlertEvaluator.evaluate(context);
    alertsCreated += theme5dAccelerationAlertEvaluator.evaluate(context);
    alertsCreated += themeDistributeWarningAlertEvaluator.evaluate(context);
    alertsCreated += evaluateThemePhaseBreakoutEntry(signalDate);
    alertsCreated += themeFailedBreakoutAlertEvaluator.evaluate(context);
    alertsCreated += themeSetupAccelerationAlertEvaluator.evaluate(context);
    alertsCreated += evaluateThemePhaseFading(signalDate);
    alertsCreated += themeMomentumExhaustionAlertEvaluator.evaluate(context);
    alertsCreated += evaluateThemeRecoverySignal(signalDate);
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



  /**
   * Fires when a sector has an active BUY trade signal but less than 40% of its sub-sectors are in
   * Leading/Improving RRG quadrants — the sector-level signal lacks internal breadth confirmation.
   * This pattern warns that the top-level momentum may be driven by a minority of sub-sectors and
   * could be fragile.
   *
   * <p>Resolves when sub-sector breadth recovers to ≥55% or the parent sector's BUY signal is gone.
   */
  private int evaluateSubSectorBreadthDivergence(
      LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SUB_SECTOR_BREADTH_DIV);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      List<String> subIds;
      try {
        subIds =
            categoryRepository.findSubCategoriesByParentId(categoryId).stream()
                .map(c -> c.id().name())
                .toList();
      } catch (IllegalArgumentException e) {
        log.debug(
            "sub_sector_breadth_divergence: skipping {}, sub-category enum mismatch", categoryId);
        continue;
      }

      boolean hasActive =
          alertRepository.existsActiveAlert(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);

      if (subIds.size() < SUB_SECTOR_MIN_COUNT) {
        if (hasActive) {
          alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);
        }
        continue;
      }

      List<BigDecimal> subQuadrants =
          subIds.stream().map(rrgMap::get).filter(q -> q != null).toList();
      if (subQuadrants.size() < SUB_SECTOR_MIN_COUNT) continue;

      long bullishCount =
          subQuadrants.stream().filter(q -> q.intValue() == 3 || q.intValue() == 4).count();
      double breadth = (double) bullishCount / subQuadrants.size();

      boolean hasBuyAlert = alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId);
      boolean weakBreadth = breadth < SUB_SECTOR_BREADTH_FIRE_FRACTION;

      if (hasBuyAlert && weakBreadth && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          continue;
        }
        String message =
            String.format(
                "%s BUY signal has weak sub-sector breadth: only %d%% of sub-sectors are in Leading/Improving RRG (%d/%d) — sector signal may lack internal confirmation",
                categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size());
        String snapshot =
            String.format(
                "{\"parentSignal\":\"BUY\",\"subBreadth\":%.2f,\"bullishCount\":%d,\"totalSubSectors\":%d,\"signalDate\":\"%s\"}",
                breadth, (int) bullishCount, subQuadrants.size(), signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_SUB_SECTOR_BREADTH_DIV,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "sub_sector_breadth_divergence: fired category={} breadth={}% ({}/{})",
            categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size());
        count++;
      } else if (hasActive && (!hasBuyAlert || breadth >= SUB_SECTOR_BREADTH_RESOLVE_FRACTION)) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);
        log.info(
            "sub_sector_breadth_divergence: resolved category={} hasBuyAlert={} breadth={}%",
            categoryId, hasBuyAlert, Math.round(breadth * 100));
      }
    }
    return count;
  }

  private int evaluateSubSectorBullConfluence(LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SUB_SECTOR_BULL_CONFLUENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      List<String> subIds;
      try {
        subIds =
            categoryRepository.findSubCategoriesByParentId(categoryId).stream()
                .map(c -> c.id().name())
                .toList();
      } catch (IllegalArgumentException e) {
        log.debug(
            "sub_sector_bull_confluence: skipping {}, sub-category enum mismatch", categoryId);
        continue;
      }

      boolean hasActive =
          alertRepository.existsActiveAlert(RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);

      if (subIds.size() < SUB_SECTOR_MIN_COUNT) {
        if (hasActive) {
          alertRepository.resolveAlertsByRuleAndCategory(
              RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);
        }
        continue;
      }

      List<BigDecimal> subQuadrants =
          subIds.stream().map(rrgMap::get).filter(q -> q != null).toList();
      if (subQuadrants.size() < SUB_SECTOR_MIN_COUNT) continue;

      long bullishCount =
          subQuadrants.stream().filter(q -> q.intValue() == 3 || q.intValue() == 4).count();
      double breadth = (double) bullishCount / subQuadrants.size();

      boolean broadConfluence = breadth >= SUB_SECTOR_BULL_CONFLUENCE_FIRE_FRACTION;

      if (broadConfluence && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          continue;
        }
        String message =
            String.format(
                "%s has broad sub-sector confluence: %d%% of sub-sectors in Leading/Improving RRG (%d/%d) — internally confirmed sector rotation",
                categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size());
        String snapshot =
            String.format(
                "{\"subBreadth\":%.2f,\"bullishCount\":%d,\"totalSubSectors\":%d,\"signalDate\":\"%s\"}",
                breadth, (int) bullishCount, subQuadrants.size(), signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_SUB_SECTOR_BULL_CONFLUENCE,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "sub_sector_bull_confluence: fired category={} breadth={}% ({}/{})",
            categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size());
        count++;
      } else if (hasActive && breadth < SUB_SECTOR_BULL_CONFLUENCE_RESOLVE_FRACTION) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);
        log.info(
            "sub_sector_bull_confluence: resolved category={} breadth={}%",
            categoryId, Math.round(breadth * 100));
      }
    }
    return count;
  }

  /**
   * Fires when a theme transitions INTO the BREAKOUT phase. Compares the current phase (computed
   * from today's avg COMPOSITE + TREND_5D + TREND_20D) with the phase 5 trading days ago. Fires
   * only on the first day the theme enters BREAKOUT. Resolves when the theme exits BREAKOUT and is
   * no longer in MOMENTUM either (breakout confirmed ended).
   */
  private int evaluateThemePhaseBreakoutEntry(LocalDate signalDate) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_PHASE_BREAKOUT_ENTRY);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> currentComposite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> currentTrend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> currentTrend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (currentComposite.isEmpty()) return 0;

    // Prior-date signal maps are loaded lazily — only when the first BREAKOUT theme is found.
    // This avoids 5 chained findPreviousSignalDate calls when no theme is in BREAKOUT.
    boolean priorDataLoaded = false;
    Map<String, BigDecimal> priorComposite = Map.of();
    Map<String, BigDecimal> priorTrend5d = Map.of();
    Map<String, BigDecimal> priorTrend20d = Map.of();

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avgCurrentScore =
          ids.stream()
              .map(currentComposite::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avgCurrentScore.isEmpty()) continue;

      OptionalDouble avgCurrent5d =
          ids.stream()
              .map(currentTrend5d::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      OptionalDouble avgCurrent20d =
          ids.stream()
              .map(currentTrend20d::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();

      String currentPhase =
          computeThemePhaseForAlert(
              avgCurrentScore.getAsDouble(),
              avgCurrent5d.isPresent() ? avgCurrent5d.getAsDouble() : null,
              avgCurrent20d.isPresent() ? avgCurrent20d.getAsDouble() : null);

      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_PHASE_BREAKOUT_ENTRY, themeId);

      if ("BREAKOUT".equals(currentPhase) && !hasActive) {
        if (!priorDataLoaded) {
          LocalDate priorDate =
              findNthPreviousSignalDate(
                  SignalType.COMPOSITE, signalDate, THEME_PHASE_LOOKBACK_DAYS);
          if (priorDate != null) {
            priorComposite = signalRepository.findByTypeAndDate(SignalType.COMPOSITE, priorDate);
            priorTrend5d =
                signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, priorDate);
            priorTrend20d =
                signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, priorDate);
          }
          priorDataLoaded = true;
        }

        OptionalDouble avgPriorScore =
            ids.stream()
                .map(priorComposite::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();
        OptionalDouble avgPrior5d =
            ids.stream()
                .map(priorTrend5d::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();
        OptionalDouble avgPrior20d =
            ids.stream()
                .map(priorTrend20d::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();
        String priorPhase =
            avgPriorScore.isPresent()
                ? computeThemePhaseForAlert(
                    avgPriorScore.getAsDouble(),
                    avgPrior5d.isPresent() ? avgPrior5d.getAsDouble() : null,
                    avgPrior20d.isPresent() ? avgPrior20d.getAsDouble() : null)
                : "UNKNOWN";

        if (!"BREAKOUT".equals(priorPhase)) {
          Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
          int scorePct = (int) Math.round(avgCurrentScore.getAsDouble() * 100);
          double delta =
              (avgCurrent5d.isPresent() && avgCurrent20d.isPresent())
                  ? avgCurrent5d.getAsDouble() - avgCurrent20d.getAsDouble()
                  : 0;
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_PHASE_BREAKOUT_ENTRY,
                  severity,
                  String.format(
                      "%s theme entered BREAKOUT phase (was %s): score %d, 5d accelerating +%dpt vs 20d — high-conviction entry signal",
                      themeId, priorPhase, scorePct, (int) Math.round(delta * 100)),
                  String.format(
                      "{\"themeId\":\"%s\",\"priorPhase\":\"%s\",\"score\":%.4f,\"delta5d20d\":%.4f,\"signalDate\":\"%s\"}",
                      themeId, priorPhase, avgCurrentScore.getAsDouble(), delta, signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info(
              "theme_phase_breakout_entry: theme={} priorPhase={} score={}",
              themeId,
              priorPhase,
              scorePct);
        }
      } else if (hasActive
          && !"BREAKOUT".equals(currentPhase)
          && !"MOMENTUM".equals(currentPhase)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_PHASE_BREAKOUT_ENTRY, themeId);
        log.info(
            "theme_phase_breakout_entry: resolved theme={} (phase now {})", themeId, currentPhase);
      }
    }
    return count;
  }

  private LocalDate findNthPreviousSignalDate(SignalType type, LocalDate date, int n) {
    LocalDate result = date;
    for (int i = 0; i < n; i++) {
      result = signalRepository.findPreviousSignalDate(type, result);
      if (result == null) return null;
    }
    return result;
  }

  private static String computeThemePhaseForAlert(double score, Double trend5d, Double trend20d) {
    boolean accelerating = trend5d != null && trend20d != null && (trend5d - trend20d) > 0.005;
    boolean trending = trend20d != null && trend20d > 0.003;
    boolean fading = trend20d != null && trend20d < -0.003;
    if (score >= 0.65) {
      if (accelerating) return "BREAKOUT";
      if (trending) return "MOMENTUM";
      return "HOLDING";
    }
    if (score >= 0.50) {
      if (accelerating) return "SETUP";
      if (fading) return "FADING";
      return "BUILDING";
    }
    if (fading) return "FADING";
    if (score < 0.35) return "WEAK";
    return "NEUTRAL";
  }

  /**
   * Fires the first time a theme enters the FADING phase (was not FADING N trading days ago, now
   * is). FADING = score 0.35–0.65 with negative 20d trend OR score below 0.35 with negative trend.
   *
   * <p>Resolves when the theme exits FADING: score recovers above THEME_FADING_RESOLVE_SCORE or
   * trend turns non-negative.
   */
  private int evaluateThemePhaseFading(LocalDate signalDate) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_PHASE_FADING);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> currentComposite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> currentTrend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> currentTrend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (currentComposite.isEmpty()) return 0;

    boolean priorDataLoaded = false;
    Map<String, BigDecimal> priorComposite = Map.of();
    Map<String, BigDecimal> priorTrend5d = Map.of();
    Map<String, BigDecimal> priorTrend20d = Map.of();

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avgCurrentScore =
          ids.stream()
              .map(currentComposite::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avgCurrentScore.isEmpty()) continue;

      OptionalDouble avgCurrent5d =
          ids.stream()
              .map(currentTrend5d::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      OptionalDouble avgCurrent20d =
          ids.stream()
              .map(currentTrend20d::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();

      String currentPhase =
          computeThemePhaseForAlert(
              avgCurrentScore.getAsDouble(),
              avgCurrent5d.isPresent() ? avgCurrent5d.getAsDouble() : null,
              avgCurrent20d.isPresent() ? avgCurrent20d.getAsDouble() : null);

      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_PHASE_FADING, themeId);

      if ("FADING".equals(currentPhase) && !hasActive) {
        if (!priorDataLoaded) {
          LocalDate priorDate =
              findNthPreviousSignalDate(
                  SignalType.COMPOSITE, signalDate, THEME_PHASE_LOOKBACK_DAYS);
          if (priorDate != null) {
            priorComposite = signalRepository.findByTypeAndDate(SignalType.COMPOSITE, priorDate);
            priorTrend5d =
                signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, priorDate);
            priorTrend20d =
                signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, priorDate);
          }
          priorDataLoaded = true;
        }

        OptionalDouble avgPriorScore =
            ids.stream()
                .map(priorComposite::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();
        OptionalDouble avgPrior5d =
            ids.stream()
                .map(priorTrend5d::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();
        OptionalDouble avgPrior20d =
            ids.stream()
                .map(priorTrend20d::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();
        String priorPhase =
            avgPriorScore.isPresent()
                ? computeThemePhaseForAlert(
                    avgPriorScore.getAsDouble(),
                    avgPrior5d.isPresent() ? avgPrior5d.getAsDouble() : null,
                    avgPrior20d.isPresent() ? avgPrior20d.getAsDouble() : null)
                : "UNKNOWN";

        if (!"FADING".equals(priorPhase)) {
          Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
          int scorePct = (int) Math.round(avgCurrentScore.getAsDouble() * 100);
          String fromPhase = avgPriorScore.isPresent() ? priorPhase : "UNKNOWN";
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_PHASE_FADING,
                  severity,
                  String.format(
                      "%s entered FADING phase (was %s): score %d with negative trend — reduce exposure, watch for failed recovery",
                      themeId, fromPhase, scorePct),
                  String.format(
                      "{\"themeId\":\"%s\",\"priorPhase\":\"%s\",\"score\":%.4f,\"signalDate\":\"%s\"}",
                      themeId, fromPhase, avgCurrentScore.getAsDouble(), signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info(
              "theme_phase_fading: theme={} priorPhase={} score={}", themeId, fromPhase, scorePct);
        }
      } else if (hasActive && !"FADING".equals(currentPhase)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_PHASE_FADING, themeId);
        log.info("theme_phase_fading: resolved theme={} (phase now {})", themeId, currentPhase);
      }
    }
    return count;
  }

  /**
   * Fires when a FADING or WEAK theme shows nascent recovery: score in [0.35, 0.55], 5d trend
   * positive (> 0.003), and 5 trading days ago the 20d trend was still negative. This catches the
   * turn before the phase fully resolves to BUILDING/SETUP.
   *
   * <p>Resolves when score rises above 0.60 (confirmed recovery) or drops below 0.30 (failed).
   */
  private int evaluateThemeRecoverySignal(LocalDate signalDate) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_RECOVERY_SIGNAL);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> compositeMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trend5dMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    if (compositeMap.isEmpty()) return 0;

    int count = 0;
    boolean priorDataLoaded = false;
    Map<String, BigDecimal> priorTrend20d = Collections.emptyMap();

    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avgScore =
          ids.stream()
              .map(compositeMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      OptionalDouble avgTrend5d =
          ids.stream()
              .map(trend5dMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();

      if (avgScore.isEmpty() || avgTrend5d.isEmpty()) continue;

      double score = avgScore.getAsDouble();
      double trend5d = avgTrend5d.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_RECOVERY_SIGNAL, themeId);

      boolean inRecoveryZone =
          score >= THEME_RECOVERY_SCORE_MIN
              && score <= THEME_RECOVERY_SCORE_MAX
              && trend5d > THEME_RECOVERY_5D_MIN;

      if (inRecoveryZone && !hasActive) {
        if (!priorDataLoaded) {
          LocalDate priorDate =
              findNthPreviousSignalDate(
                  SignalType.COMPOSITE, signalDate, THEME_PHASE_LOOKBACK_DAYS);
          if (priorDate != null) {
            priorTrend20d =
                signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, priorDate);
          }
          priorDataLoaded = true;
        }

        OptionalDouble avgPrior20d =
            ids.stream()
                .map(priorTrend20d::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();

        boolean priorWasNegative =
            avgPrior20d.isPresent() && avgPrior20d.getAsDouble() < THEME_RECOVERY_PRIOR_20D_MAX;

        if (priorWasNegative) {
          Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);
          int scorePct = (int) Math.round(score * 100);
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_RECOVERY_SIGNAL,
                  severity,
                  String.format(
                      "%s showing recovery: score %d, 5d trend +%.1fpt/day (20d was negative 5 days ago) — early turn signal, watch for follow-through",
                      themeId, scorePct, trend5d * 100),
                  String.format(
                      "{\"themeId\":\"%s\",\"score\":%.4f,\"trend5d\":%.4f,\"priorTrend20d\":%.4f,\"signalDate\":\"%s\"}",
                      themeId, score, trend5d, avgPrior20d.getAsDouble(), signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info(
              "theme_recovery_signal: theme={} score={} trend5d={} priorTrend20d={}",
              themeId,
              scorePct,
              String.format("%.3f", trend5d),
              String.format("%.3f", avgPrior20d.getAsDouble()));
        }
      } else if (hasActive
          && (score > THEME_RECOVERY_RESOLVE_SCORE_HIGH
              || score < THEME_RECOVERY_RESOLVE_SCORE_LOW)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_RECOVERY_SIGNAL, themeId);
        log.info(
            "theme_recovery_signal: resolved theme={} (score={})",
            themeId,
            (int) Math.round(score * 100));
      }
    }
    return count;
  }
}



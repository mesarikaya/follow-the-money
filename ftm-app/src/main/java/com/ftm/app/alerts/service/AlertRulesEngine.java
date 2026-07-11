package com.ftm.app.alerts.service;

import com.ftm.app.alerts.evaluator.AlertEvaluationContext;
import com.ftm.app.alerts.evaluator.BreadthVelocityAlertEvaluator;
import com.ftm.app.alerts.evaluator.MacroRegimeShiftAlertEvaluator;
import com.ftm.app.alerts.evaluator.PersistenceLowAlertEvaluator;
import com.ftm.app.alerts.evaluator.RsAlignedAlertEvaluator;
import com.ftm.app.alerts.evaluator.RsBreadthExtremeAlertEvaluator;
import com.ftm.app.alerts.evaluator.ScoreApproachingSignalEvaluator;
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
import com.ftm.app.api.service.TradeSignalDeriver;
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
  private static final String RULE_RS_ACCEL_CROSSOVER = "rs_accel_crossover";
  private static final String RULE_PERSISTENCE_LOW = "persistence_low";
  private static final String RULE_BREADTH_VELOCITY_ACCEL = "breadth_velocity_accel";
  private static final String RULE_BREADTH_VELOCITY_DECEL = "breadth_velocity_decel";
  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";
  private static final String RULE_TRADE_SIGNAL_REDUCE = "trade_signal_reduce";
  private static final String RULE_SCORE_APPROACHING_BUY = "score_approaching_buy";
  private static final String RULE_SCORE_APPROACHING_REDUCE = "score_approaching_reduce";
  private static final String RULE_HIGH_CONVICTION_BUY = "high_conviction_buy";
  private static final int HIGH_CONVICTION_THRESHOLD = 75;
  private static final int HIGH_CONVICTION_RESOLVE_THRESHOLD = 65;
  private static final String RULE_HIGH_CONVICTION_CLUSTER = "high_conviction_cluster";
  private static final String RULE_HIGH_CONVICTION_REDUCE_CLUSTER =
      "high_conviction_reduce_cluster";
  private static final int CLUSTER_MIN_SIZE = 3;
  private static final int CLUSTER_RESOLVE_SIZE = 2;
  private static final int REDUCE_CLUSTER_CONVICTION_THRESHOLD = 40;
  private static final String RULE_SIGNAL_DETERIORATION = "signal_deterioration";
  private static final String RULE_FLOW_SURGE = "flow_surge";
  private static final String RULE_RS_ALIGNED_BULL = "rs_aligned_bull";
  private static final String RULE_RS_ALIGNED_BEAR = "rs_aligned_bear";
  private static final String RULE_PRE_BUY_FLOW_SURGE = "pre_buy_flow_surge";
  private static final String RULE_RRG_RS_DIVERGENCE = "rrg_rs_divergence";
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
  private static final BigDecimal PRE_BUY_FLOW_SURGE_Z_THRESHOLD = new BigDecimal("1.5");
  private static final BigDecimal PRE_BUY_FLOW_SURGE_RESOLVE_Z = new BigDecimal("0.8");
  private static final BigDecimal DETERIORATION_RECOVERY_THRESHOLD = new BigDecimal("-0.02");
  private static final BigDecimal APPROACHING_BUY_LOWER = new BigDecimal("0.55");
  private static final BigDecimal PERSISTENCE_RECOVERY_THRESHOLD = new BigDecimal("8");
  private static final int BREADTH_VELOCITY_THRESHOLD_PP = 10;
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");
  private static final String RULE_CROSS_HORIZON_RS_DIV = "cross_horizon_rs_divergence";
  private static final double CROSS_HORIZON_RS_MIN_GAP = 0.001;
  private static final String RULE_MACRO_SECTOR_MISMATCH = "macro_sector_mismatch";
  // Cyclical sectors: leadership in a risk-off macro regime is anomalous and warrants a flag
  private static final Set<String> CYCLICAL_CATEGORY_IDS =
      Set.of("TECH", "DISR", "FINL", "INDU", "ENRG", "MATL");
  // Risk-off macro regime ordinals (STAGFLATION=0, RISK_OFF_FLIGHT=1)
  private static final Set<Integer> RISK_OFF_REGIME_ORDINALS = Set.of(0, 1);
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
      ScoreApproachingSignalEvaluator scoreApproachingSignalEvaluator) {
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
    alertsCreated += evaluateRsAccelerationCrossover(signalDate, topLevelCategoryIds);
    alertsCreated += persistenceLowAlertEvaluator.evaluate(context);
    alertsCreated += breadthVelocityAlertEvaluator.evaluate(context);
    alertsCreated += evaluateTradeSignalTransitions(signalDate, topLevelCategoryIds);
    alertsCreated += scoreApproachingSignalEvaluator.evaluate(context);
    alertsCreated += evaluateHighConvictionBuy(signalDate, topLevelCategoryIds);
    alertsCreated += evaluateHighConvictionCluster(signalDate, topLevelCategoryIds);
    alertsCreated += evaluateHighConvictionReduceCluster(signalDate, topLevelCategoryIds);
    alertsCreated += signalDeteriorationAlertEvaluator.evaluate(context);
    alertsCreated += rsAlignedAlertEvaluator.evaluate(context);
    alertsCreated += evaluatePreBuyFlowSurge(signalDate, topLevelCategoryIds);
    alertsCreated += rsBreadthExtremeAlertEvaluator.evaluate(context);
    alertsCreated += evaluateRrgRsDivergence(signalDate, equityCategoryIds);
    alertsCreated += scorePercentileExtremeAlertEvaluator.evaluate(context);
    alertsCreated += scoreVelocityAlertEvaluator.evaluate(context);
    alertsCreated += evaluateCrossHorizonRsDivergence(signalDate, equityCategoryIds);
    alertsCreated += evaluateMacroSectorMismatch(signalDate, equityCategoryIds);
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

  private int evaluateRsAccelerationCrossover(
      LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rsAccelRule = alertRulesRepository.findById(RULE_RS_ACCEL_CROSSOVER);
    if (!rsAccelRule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rsAccelRule.map(AlertRule::severity).orElse(Severity.INFO);

    Map<String, BigDecimal> currentRs60 =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    Map<String, BigDecimal> currentRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate);
    if (currentRs60.isEmpty() || currentRs120.isEmpty()) return 0;

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.RS_60, signalDate);
    if (prevDate == null) return 0;

    Map<String, BigDecimal> prevRs60 =
        signalRepository.findByTypeAndDate(SignalType.RS_60, prevDate);
    Map<String, BigDecimal> prevRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, prevDate);

    int count = 0;
    for (String categoryId : currentRs60.keySet()) {
      if (!topLevelCategoryIds.contains(categoryId)) continue;
      BigDecimal rs60 = currentRs60.get(categoryId);
      BigDecimal rs120 = currentRs120.get(categoryId);
      BigDecimal prevRs60Val = prevRs60.get(categoryId);
      BigDecimal prevRs120Val = prevRs120.get(categoryId);

      if (rs60 == null || rs120 == null || prevRs60Val == null || prevRs120Val == null) continue;

      boolean nowAbove = rs60.compareTo(rs120) > 0;
      boolean wasAbove = prevRs60Val.compareTo(prevRs120Val) > 0;
      if (nowAbove == wasAbove) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("rs_accel_crossover: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      if (!alertRepository.existsActiveAlert(RULE_RS_ACCEL_CROSSOVER, categoryId)) {
        String message =
            nowAbove
                ? String.format(
                    "%s RS-60 crossed above RS-120 — near-term momentum accelerating beyond long-term baseline",
                    categoryId)
                : String.format(
                    "%s RS-60 crossed below RS-120 — near-term momentum decelerating below long-term baseline",
                    categoryId);
        String snapshot =
            String.format(
                "{\"direction\":\"%s\",\"rs60\":%.4f,\"rs120\":%.4f,\"prevRs60\":%.4f,\"prevRs120\":%.4f,\"signalDate\":\"%s\"}",
                nowAbove ? "bullish" : "bearish",
                rs60,
                rs120,
                prevRs60Val,
                prevRs120Val,
                signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_RS_ACCEL_CROSSOVER,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "rs_accel_crossover alert: category={} direction={} rs60={} rs120={}",
            categoryId,
            nowAbove ? "bullish" : "bearish",
            rs60,
            rs120);
      }
    }
    return count;
  }

  private int evaluateTradeSignalTransitions(
      LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> buyRule = alertRulesRepository.findById(RULE_TRADE_SIGNAL_BUY);
    Optional<AlertRule> reduceRule = alertRulesRepository.findById(RULE_TRADE_SIGNAL_REDUCE);

    boolean buyEnabled = buyRule.map(AlertRule::enabled).orElse(false);
    boolean reduceEnabled = reduceRule.map(AlertRule::enabled).orElse(false);
    if (!buyEnabled && !reduceEnabled) return 0;

    Severity buySeverity = buyRule.map(AlertRule::severity).orElse(Severity.ACTION);
    Severity reduceSeverity = reduceRule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> trend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> prevComposite =
        prevDate != null
            ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, prevDate)
            : Map.of();
    Map<String, BigDecimal> prevRrg =
        prevDate != null
            ? signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, prevDate)
            : Map.of();
    Map<String, BigDecimal> prevTrend =
        prevDate != null
            ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, prevDate)
            : Map.of();

    int count = 0;
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = composite.get(categoryId);
      BigDecimal rrg = rrgQuadrant.get(categoryId);
      BigDecimal trend = trend20d.get(categoryId);
      if (score == null) continue;

      int rrgInt = rrg != null ? rrg.intValue() : 0;
      boolean buyNow =
          score.compareTo(BUY_SCORE_THRESHOLD) >= 0
              && (rrgInt == 3 || rrgInt == 4)
              && trend != null
              && trend.compareTo(BigDecimal.ZERO) > 0;

      boolean reduceNow =
          score.compareTo(REDUCE_SCORE_THRESHOLD) < 0 && (rrgInt == 1 || rrgInt == 2);

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        continue;
      }

      if (buyEnabled && buyNow) {
        BigDecimal prevScore = prevComposite.get(categoryId);
        BigDecimal prevRrgVal = prevRrg.get(categoryId);
        BigDecimal prevTrendVal = prevTrend.get(categoryId);
        int prevRrgInt = prevRrgVal != null ? prevRrgVal.intValue() : 0;
        boolean buyPrev =
            prevScore != null
                && prevScore.compareTo(BUY_SCORE_THRESHOLD) >= 0
                && (prevRrgInt == 3 || prevRrgInt == 4)
                && prevTrendVal != null
                && prevTrendVal.compareTo(BigDecimal.ZERO) > 0;

        if (!buyPrev && !alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId)) {
          int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
          String rrgLabel = rrgInt == 4 ? "Leading" : "Improving";
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_TRADE_SIGNAL_BUY,
                  buySeverity,
                  String.format(
                      "%s full BUY signal triggered: score=%d, RRG=%s, 20d trend positive — all three conditions aligned",
                      categoryId, scorePct, rrgLabel),
                  String.format(
                      "{\"score\":%d,\"rrgQuadrant\":%d,\"trend20d\":%.4f,\"signalDate\":\"%s\"}",
                      scorePct, rrgInt, trend.doubleValue(), signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info("trade_signal_buy: category={} score={} rrg={}", categoryId, scorePct, rrgLabel);
        }
      }

      if (reduceEnabled && reduceNow) {
        BigDecimal prevScore = prevComposite.get(categoryId);
        BigDecimal prevRrgVal = prevRrg.get(categoryId);
        int prevRrgInt = prevRrgVal != null ? prevRrgVal.intValue() : 0;
        boolean reducePrev =
            prevScore != null
                && prevScore.compareTo(REDUCE_SCORE_THRESHOLD) < 0
                && (prevRrgInt == 1 || prevRrgInt == 2);

        if (!reducePrev
            && !alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_REDUCE, categoryId)) {
          int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
          String rrgLabel = rrgInt == 1 ? "Lagging" : "Weakening";
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_TRADE_SIGNAL_REDUCE,
                  reduceSeverity,
                  String.format(
                      "%s REDUCE signal: score=%d with %s RRG — consider trimming position",
                      categoryId, scorePct, rrgLabel),
                  String.format(
                      "{\"score\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                      scorePct, rrgInt, signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info(
              "trade_signal_reduce: category={} score={} rrg={}", categoryId, scorePct, rrgLabel);
        }
      }
    }
    return count;
  }


  private record ConvictionSignalMaps(
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> rrg,
      Map<String, BigDecimal> trend20d,
      Map<String, BigDecimal> macroFit,
      Map<String, BigDecimal> trend5d,
      Map<String, BigDecimal> rs60,
      Map<String, BigDecimal> rs120,
      Map<String, BigDecimal> flow20d,
      Map<String, BigDecimal> rs20,
      Map<String, BigDecimal> percentile252d) {}

  private ConvictionSignalMaps fetchConvictionSignals() {
    Map<SignalType, Map<String, BigDecimal>> signals =
        signalRepository.findLatestByTypes(
            List.of(
                SignalType.COMPOSITE,
                SignalType.RRG_QUADRANT,
                SignalType.COMPOSITE_TREND_20D,
                SignalType.MACRO_FIT,
                SignalType.COMPOSITE_TREND_5D,
                SignalType.RS_60,
                SignalType.RS_120,
                SignalType.FLOW_20D,
                SignalType.RS_20));
    return new ConvictionSignalMaps(
        signals.getOrDefault(SignalType.COMPOSITE, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RRG_QUADRANT, Collections.emptyMap()),
        signals.getOrDefault(SignalType.COMPOSITE_TREND_20D, Collections.emptyMap()),
        signals.getOrDefault(SignalType.MACRO_FIT, Collections.emptyMap()),
        signals.getOrDefault(SignalType.COMPOSITE_TREND_5D, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RS_60, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RS_120, Collections.emptyMap()),
        signals.getOrDefault(SignalType.FLOW_20D, Collections.emptyMap()),
        signals.getOrDefault(SignalType.RS_20, Collections.emptyMap()),
        signalRepository.findScorePercentile252d());
  }

  private int evaluateHighConvictionBuy(LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_HIGH_CONVICTION_BUY);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);

    ConvictionSignalMaps maps = fetchConvictionSignals();
    Map<String, BigDecimal> compositeByCategory = maps.composite();
    Map<String, BigDecimal> rrgByCategory = maps.rrg();
    Map<String, BigDecimal> trend20dByCategory = maps.trend20d();
    Map<String, BigDecimal> macroFitByCategory = maps.macroFit();
    Map<String, BigDecimal> trend5dByCategory = maps.trend5d();
    Map<String, BigDecimal> percentile252dByCategory = maps.percentile252d();

    int count = 0;
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = compositeByCategory.get(categoryId);
      if (score == null) continue;

      BigDecimal rrg = rrgByCategory.get(categoryId);
      BigDecimal trend20d = trend20dByCategory.get(categoryId);
      BigDecimal macroFit = macroFitByCategory.get(categoryId);
      BigDecimal percentile = percentile252dByCategory.get(categoryId);
      BigDecimal trend5d = trend5dByCategory.get(categoryId);
      String rrgStr = rrg != null ? String.valueOf(rrg.intValue()) : null;

      int conviction =
          TradeSignalDeriver.convictionScore(
              score,
              rrgStr,
              trend20d,
              macroFit,
              percentile,
              trend5d,
              maps.rs60().get(categoryId),
              maps.rs120().get(categoryId),
              maps.flow20d().get(categoryId),
              maps.rs20().get(categoryId));

      boolean hasActiveAlert =
          alertRepository.existsActiveAlert(RULE_HIGH_CONVICTION_BUY, categoryId);

      if (conviction >= HIGH_CONVICTION_THRESHOLD && !hasActiveAlert) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("high_conviction_buy: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
        int macroPct = macroFit != null ? macroFit.multiply(BigDecimal.valueOf(100)).intValue() : 0;
        int pctRank =
            percentile != null ? percentile.multiply(BigDecimal.valueOf(100)).intValue() : 0;
        String rrgLabel =
            rrg != null
                ? switch (rrg.intValue()) {
                  case 4 -> "Leading";
                  case 3 -> "Improving";
                  default -> "Q" + rrg.intValue();
                }
                : "Unknown";
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_HIGH_CONVICTION_BUY,
                severity,
                String.format(
                    "%s high-conviction BUY — conviction %d/100: score=%d, macro fit=%d%%, 252d rank=P%d, RRG %s",
                    categoryId, conviction, scorePct, macroPct, pctRank, rrgLabel),
                String.format(
                    "{\"conviction\":%d,\"score\":%d,\"macroFitPct\":%d,\"percentile252d\":%d,\"rrgQuadrant\":\"%s\",\"signalDate\":\"%s\"}",
                    conviction, scorePct, macroPct, pctRank, rrgLabel, signalDate),
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "high_conviction_buy: category={} conviction={} score={} macroFit={}% P252={}",
            categoryId, conviction, scorePct, macroPct, pctRank);
      } else if (conviction < HIGH_CONVICTION_RESOLVE_THRESHOLD && hasActiveAlert) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_HIGH_CONVICTION_BUY, categoryId);
      }
    }
    return count;
  }

  private int evaluateHighConvictionCluster(LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_HIGH_CONVICTION_CLUSTER);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);

    ConvictionSignalMaps maps = fetchConvictionSignals();

    // Collect all categories with conviction >= CLUSTER_MIN_THRESHOLD
    List<String> highConvictionIds = new java.util.ArrayList<>();
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = maps.composite().get(categoryId);
      if (score == null) continue;
      String rrgStr =
          maps.rrg().containsKey(categoryId)
              ? String.valueOf(maps.rrg().get(categoryId).intValue())
              : null;
      int conviction =
          TradeSignalDeriver.convictionScore(
              score,
              rrgStr,
              maps.trend20d().get(categoryId),
              maps.macroFit().get(categoryId),
              maps.percentile252d().get(categoryId),
              maps.trend5d().get(categoryId),
              maps.rs60().get(categoryId),
              maps.rs120().get(categoryId),
              maps.flow20d().get(categoryId),
              maps.rs20().get(categoryId));
      if (conviction >= HIGH_CONVICTION_THRESHOLD) {
        highConvictionIds.add(categoryId);
      }
    }

    int clusterSize = highConvictionIds.size();
    boolean hasActiveAlert = alertRepository.existsActiveAlert(RULE_HIGH_CONVICTION_CLUSTER, null);

    if (clusterSize >= CLUSTER_MIN_SIZE && !hasActiveAlert) {
      String tickers = String.join(", ", highConvictionIds.stream().sorted().limit(5).toList());
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              null,
              RULE_HIGH_CONVICTION_CLUSTER,
              severity,
              String.format(
                  "HIGH CONVICTION CLUSTER: %d sectors at conviction ≥%d — broad RISK-ON regime confirmed (%s)",
                  clusterSize, HIGH_CONVICTION_THRESHOLD, tickers),
              String.format(
                  "{\"clusterSize\":%d,\"sectors\":\"%s\",\"signalDate\":\"%s\"}",
                  clusterSize, tickers, signalDate),
              AlertStatus.ACTIVE));
      log.info("high_conviction_cluster: clusterSize={} sectors={}", clusterSize, tickers);
      return 1;
    } else if (clusterSize < CLUSTER_RESOLVE_SIZE && hasActiveAlert) {
      alertRepository.resolveAlertsByRuleAndCategory(RULE_HIGH_CONVICTION_CLUSTER, null);
      log.info("high_conviction_cluster: resolved, clusterSize dropped to {}", clusterSize);
    }
    return 0;
  }

  /**
   * Fires when 3+ sectors simultaneously have high-conviction REDUCE signals (conviction ≥ 40). A
   * synchronized multi-sector REDUCE cluster indicates systemic risk-off rotation — not just
   * single-sector weakness. This is the REDUCE counterpart to high_conviction_cluster (BUY regime).
   * Resolves when the cluster shrinks below 2 sectors.
   */
  private int evaluateHighConvictionReduceCluster(
      LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_HIGH_CONVICTION_REDUCE_CLUSTER);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);

    ConvictionSignalMaps maps = fetchConvictionSignals();

    List<String> reduceClusterIds = new java.util.ArrayList<>();
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = maps.composite().get(categoryId);
      if (score == null) continue;
      String rrgStr =
          maps.rrg().containsKey(categoryId)
              ? String.valueOf(maps.rrg().get(categoryId).intValue())
              : null;
      String signal = TradeSignalDeriver.derive(score, rrgStr, maps.trend20d().get(categoryId));
      if (!"REDUCE".equals(signal)) continue;
      int conviction =
          TradeSignalDeriver.convictionScore(
              score,
              rrgStr,
              maps.trend20d().get(categoryId),
              maps.macroFit().get(categoryId),
              maps.percentile252d().get(categoryId),
              maps.trend5d().get(categoryId),
              maps.rs60().get(categoryId),
              maps.rs120().get(categoryId),
              maps.flow20d().get(categoryId),
              maps.rs20().get(categoryId));
      if (conviction >= REDUCE_CLUSTER_CONVICTION_THRESHOLD) {
        reduceClusterIds.add(categoryId);
      }
    }

    int clusterSize = reduceClusterIds.size();
    boolean hasActiveAlert =
        alertRepository.existsActiveAlert(RULE_HIGH_CONVICTION_REDUCE_CLUSTER, null);

    if (clusterSize >= CLUSTER_MIN_SIZE && !hasActiveAlert) {
      String tickers = String.join(", ", reduceClusterIds.stream().sorted().limit(5).toList());
      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              null,
              RULE_HIGH_CONVICTION_REDUCE_CLUSTER,
              severity,
              String.format(
                  "REDUCE CLUSTER: %d sectors at conviction ≥%d — broad RISK-OFF rotation detected (%s)",
                  clusterSize, REDUCE_CLUSTER_CONVICTION_THRESHOLD, tickers),
              String.format(
                  "{\"clusterSize\":%d,\"sectors\":\"%s\",\"signalDate\":\"%s\"}",
                  clusterSize, tickers, signalDate),
              AlertStatus.ACTIVE));
      log.info("high_conviction_reduce_cluster: clusterSize={} sectors={}", clusterSize, tickers);
      return 1;
    } else if (clusterSize < CLUSTER_RESOLVE_SIZE && hasActiveAlert) {
      alertRepository.resolveAlertsByRuleAndCategory(RULE_HIGH_CONVICTION_REDUCE_CLUSTER, null);
      log.info("high_conviction_reduce_cluster: resolved, clusterSize dropped to {}", clusterSize);
    }
    return 0;
  }

  /**
   * Fires when a sector is in the pre-BUY approach zone (score 0.55–0.65) AND institutional flow is
   * surging (FLOW_20D z-score ≥ 1.5). This combination means institutional money is moving in
   * before the composite score crosses the full BUY threshold — a leading indicator for an imminent
   * BUY signal. Resolves when score exits the approach zone (either drops back or reaches full
   * BUY), or when the flow surge dissipates (z < 0.8).
   */
  private int evaluatePreBuyFlowSurge(LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_PRE_BUY_FLOW_SURGE);
    if (rule.isEmpty() || !rule.get().enabled()) return 0;
    Severity severity = rule.get().severity();

    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> flow20d =
        signalRepository.findByTypeAndDate(SignalType.FLOW_20D, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    if (composite.isEmpty() || flow20d.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = composite.get(categoryId);
      BigDecimal flowZ = flow20d.get(categoryId);
      if (score == null || flowZ == null) continue;

      boolean inApproachZone =
          score.compareTo(APPROACHING_BUY_LOWER) >= 0 && score.compareTo(BUY_SCORE_THRESHOLD) < 0;
      boolean flowSurging = flowZ.compareTo(PRE_BUY_FLOW_SURGE_Z_THRESHOLD) >= 0;
      if (!inApproachZone || !flowSurging) continue;
      if (alertRepository.existsActiveAlert(RULE_PRE_BUY_FLOW_SURGE, categoryId)) continue;
      if (alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId)) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("pre_buy_flow_surge: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
      int ptsNeeded = BUY_SCORE_THRESHOLD.multiply(BigDecimal.valueOf(100)).intValue() - scorePct;
      BigDecimal rrg = rrgQuadrant.get(categoryId);
      int rrgInt = rrg != null ? rrg.intValue() : 0;
      String rrgLabel =
          switch (rrgInt) {
            case 4 -> "Leading";
            case 3 -> "Improving";
            case 2 -> "Weakening";
            case 1 -> "Lagging";
            default -> "Unknown";
          };

      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_PRE_BUY_FLOW_SURGE,
              severity,
              String.format(
                  "%s pre-BUY flow surge: score=%d (need +%dpts for BUY), flow z=+%.1fσ — institutions positioning ahead of signal, RRG %s",
                  categoryId, scorePct, ptsNeeded, flowZ.doubleValue(), rrgLabel),
              String.format(
                  "{\"score\":%d,\"ptsNeeded\":%d,\"flowZ\":%.2f,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                  scorePct, ptsNeeded, flowZ.doubleValue(), rrgInt, signalDate),
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "pre_buy_flow_surge: category={} score={} ptsNeeded={} flowZ={}",
          categoryId,
          scorePct,
          ptsNeeded,
          flowZ);
    }
    return count;
  }

  /**
   * Fires when RRG quadrant direction contradicts RS-20 vs RS-60 momentum direction.
   *
   * <ul>
   *   <li>Bearish divergence: sector in Leading (4) or Improving (3) — RRG says strong — but RS-20
   *       &lt; RS-60 meaning short-term momentum is already cracking. Early warning that the sector
   *       is about to roll over into Weakening.
   *   <li>Bullish divergence: sector in Lagging (1) or Weakening (2) — RRG says weak — but RS-20
   *       &gt; RS-60 meaning short-term momentum has already turned up. Early recovery signal
   *       before the RRG chart catches up.
   * </ul>
   *
   * Resolves when divergence closes (RS-20/RS-60 relationship aligns with RRG direction).
   */
  private int evaluateRrgRsDivergence(LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_RRG_RS_DIVERGENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> rs20Map =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> rs60Map =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);

    if (rrgMap.isEmpty() || rs20Map.isEmpty() || rs60Map.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      BigDecimal rrgRaw = rrgMap.get(categoryId);
      BigDecimal rs20 = rs20Map.get(categoryId);
      BigDecimal rs60 = rs60Map.get(categoryId);
      if (rrgRaw == null || rs20 == null || rs60 == null) continue;

      int rrg = rrgRaw.intValue();
      boolean rrgBullish = rrg == 3 || rrg == 4; // Improving or Leading
      boolean rrgBearish = rrg == 1 || rrg == 2; // Lagging or Weakening
      int rsCmp = rs20.compareTo(rs60);
      boolean rsMomentumBullish = rsCmp > 0; // RS-20 > RS-60: short-term outpacing medium-term
      boolean rsMomentumBearish = rsCmp < 0;

      boolean bearishDivergence = rrgBullish && rsMomentumBearish; // RRG says strong, RS cracks
      boolean bullishDivergence = rrgBearish && rsMomentumBullish; // RRG says weak, RS recovers

      boolean hasActive = alertRepository.existsActiveAlert(RULE_RRG_RS_DIVERGENCE, categoryId);
      boolean anyDivergence = bearishDivergence || bullishDivergence;

      if (anyDivergence && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("rrg_rs_divergence: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String rrgLabel =
            rrg == 4 ? "Leading" : rrg == 3 ? "Improving" : rrg == 2 ? "Weakening" : "Lagging";
        String divergenceType = bearishDivergence ? "BEARISH DIVERGENCE" : "BULLISH DIVERGENCE";
        String explanation =
            bearishDivergence
                ? String.format(
                    "RRG %s (Q%d) but RS-20 already below RS-60 — momentum cracking before chart shows it",
                    rrgLabel, rrg)
                : String.format(
                    "RRG %s (Q%d) but RS-20 already above RS-60 — momentum recovering before chart shows it",
                    rrgLabel, rrg);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_RRG_RS_DIVERGENCE,
                severity,
                String.format("%s %s: %s", categoryId, divergenceType, explanation),
                String.format(
                    "{\"rrgQuadrant\":%d,\"rs20\":%.4f,\"rs60\":%.4f,\"divergenceType\":\"%s\",\"signalDate\":\"%s\"}",
                    rrg, rs20.doubleValue(), rs60.doubleValue(), divergenceType, signalDate),
                AlertStatus.ACTIVE));
        log.info(
            "rrg_rs_divergence: category={} type={} rrg={} rs20={} rs60={}",
            categoryId,
            divergenceType,
            rrg,
            rs20,
            rs60);
        count++;
      } else if (!anyDivergence && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_RRG_RS_DIVERGENCE, categoryId);
        log.info("rrg_rs_divergence: resolved for category={} (divergence closed)", categoryId);
      }
    }
    return count;
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
   * Fires when a sector's short-term RS direction (RS-20 vs RS-60) contradicts its medium-term RS
   * direction (RS-60 vs RS-120). This cross-horizon divergence identifies counter-trend moves: a
   * sector with short-term strength embedded in a medium-term downtrend (fade candidate) or
   * short-term weakness within a medium-term uptrend (pullback opportunity). Resolves when the two
   * horizons align again.
   */
  private int evaluateCrossHorizonRsDivergence(
      LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_CROSS_HORIZON_RS_DIV);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> rs20Map =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> rs60Map =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    Map<String, BigDecimal> rs120Map =
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate);
    if (rs20Map.isEmpty() || rs60Map.isEmpty() || rs120Map.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      BigDecimal rs20 = rs20Map.get(categoryId);
      BigDecimal rs60 = rs60Map.get(categoryId);
      BigDecimal rs120 = rs120Map.get(categoryId);
      if (rs20 == null || rs60 == null || rs120 == null) continue;

      double r20 = rs20.doubleValue();
      double r60 = rs60.doubleValue();
      double r120 = rs120.doubleValue();

      boolean shortTermBull = r20 > r60 + CROSS_HORIZON_RS_MIN_GAP;
      boolean shortTermBear = r20 < r60 - CROSS_HORIZON_RS_MIN_GAP;
      boolean medTermBull = r60 > r120 + CROSS_HORIZON_RS_MIN_GAP;
      boolean medTermBear = r60 < r120 - CROSS_HORIZON_RS_MIN_GAP;

      // Divergence: short-term direction contradicts medium-term direction
      boolean counterTrendBounce =
          shortTermBull && medTermBear; // strength in structurally weak sector
      boolean pullbackInBull =
          shortTermBear && medTermBull; // weakness in structurally strong sector
      boolean hasDivergence = counterTrendBounce || pullbackInBull;
      boolean hasActive = alertRepository.existsActiveAlert(RULE_CROSS_HORIZON_RS_DIV, categoryId);

      if (hasDivergence && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("cross_horizon_rs_divergence: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String divergenceType = counterTrendBounce ? "COUNTER_TREND_BOUNCE" : "PULLBACK_IN_BULL";
        String message =
            counterTrendBounce
                ? String.format(
                    "%s short-term RS spiking while medium-term RS downtrend persists — counter-trend bounce, fading risk",
                    categoryId)
                : String.format(
                    "%s short-term RS softening while medium-term RS uptrend intact — pullback in a bull, potential entry",
                    categoryId);
        String snapshot =
            String.format(
                "{\"rs20\":%.4f,\"rs60\":%.4f,\"rs120\":%.4f,\"divergenceType\":\"%s\",\"signalDate\":\"%s\"}",
                r20, r60, r120, divergenceType, signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_CROSS_HORIZON_RS_DIV,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "cross_horizon_rs_divergence: category={} type={} rs20={} rs60={} rs120={}",
            categoryId,
            divergenceType,
            rs20,
            rs60,
            rs120);
        count++;
      } else if (!hasDivergence && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_CROSS_HORIZON_RS_DIV, categoryId);
        log.info(
            "cross_horizon_rs_divergence: resolved for category={} (horizons aligned)", categoryId);
      }
    }
    return count;
  }

  /**
   * Fires when a cyclical sector (TECH, DISR, FINL, INDU, ENRG, MATL) is in RRG Leading or
   * Improving phase (quadrant 3 or 4) while the macro regime is risk-off (STAGFLATION or
   * RISK_OFF_FLIGHT). A cyclical sector leading during a risk-off macro backdrop is anomalous:
   * either the market is early-pricing a recovery (watch for confirmation) or the RRG signal is a
   * false leader that will reverse. Resolves when the regime returns to risk-on OR the sector exits
   * quadrant 3/4.
   */
  private int evaluateMacroSectorMismatch(LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_MACRO_SECTOR_MISMATCH);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> regimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, signalDate);
    if (regimeSignals.isEmpty()) return 0;

    BigDecimal regimeRaw = regimeSignals.values().stream().findFirst().orElse(null);
    if (regimeRaw == null) return 0;

    int regimeOrdinal = regimeRaw.intValue();
    boolean isRiskOff = RISK_OFF_REGIME_ORDINALS.contains(regimeOrdinal);
    String regimeName = MacroRegime.nameForOrdinal(regimeOrdinal);

    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    if (rrgMap.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      if (!CYCLICAL_CATEGORY_IDS.contains(categoryId)) continue;

      BigDecimal rrgRaw = rrgMap.get(categoryId);
      if (rrgRaw == null) continue;

      int rrg = rrgRaw.intValue();
      boolean isBullishQuadrant = rrg == 3 || rrg == 4;
      boolean hasMismatch = isRiskOff && isBullishQuadrant;
      boolean hasActive = alertRepository.existsActiveAlert(RULE_MACRO_SECTOR_MISMATCH, categoryId);

      if (hasMismatch && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("macro_sector_mismatch: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String quadrantLabel = rrg == 4 ? "Leading" : "Improving";
        String message =
            String.format(
                "%s cyclical sector in %s RRG while macro regime is %s — anomalous leadership; watch for reversal or early recovery signal",
                categoryId, quadrantLabel, regimeName);
        String snapshot =
            String.format(
                "{\"regimeOrdinal\":%d,\"regime\":\"%s\",\"rrgQuadrant\":%d,\"categoryType\":\"cyclical\",\"signalDate\":\"%s\"}",
                regimeOrdinal, regimeName, rrg, signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_MACRO_SECTOR_MISMATCH,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "macro_sector_mismatch: category={} rrg={} regime={}", categoryId, rrg, regimeName);
        count++;
      } else if (!hasMismatch && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_MACRO_SECTOR_MISMATCH, categoryId);
        log.info(
            "macro_sector_mismatch: resolved for category={} (regime={} or rrg={} changed)",
            categoryId,
            regimeName,
            rrg);
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

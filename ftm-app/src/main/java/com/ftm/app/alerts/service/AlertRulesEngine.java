package com.ftm.app.alerts.service;

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
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
 * <p>Deferred (no FLOW signals yet): - flow_inflow_5d, flow_inflow_10d, flow_inflow_20d -
 * flow_outflow_5d, flow_outflow_10d, flow_outflow_20d
 */
@Service
public class AlertRulesEngine {

  private static final Logger log = LoggerFactory.getLogger(AlertRulesEngine.class);

  private static final String RULE_RRG_TRANSITION = "rrg_transition";
  private static final String RULE_COMPOSITE_BREAKOUT = "composite_breakout";
  private static final String RULE_COMPOSITE_BREAKDOWN = "composite_breakdown";
  private static final String RULE_MACRO_REGIME_SHIFT = "macro_regime_shift";
  private static final String RULE_RS_ACCEL_CROSSOVER = "rs_accel_crossover";
  private static final String RULE_PERSISTENCE_LOW = "persistence_low";
  private static final String RULE_BREADTH_VELOCITY_ACCEL = "breadth_velocity_accel";
  private static final String RULE_BREADTH_VELOCITY_DECEL = "breadth_velocity_decel";
  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";
  private static final String RULE_TRADE_SIGNAL_REDUCE = "trade_signal_reduce";
  private static final BigDecimal PERSISTENCE_RECOVERY_THRESHOLD = new BigDecimal("8");
  private static final int BREADTH_VELOCITY_THRESHOLD_PP = 10;
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");

  private final AlertRepository alertRepository;
  private final AlertRulesRepository alertRulesRepository;
  private final RotationEventRepository rotationEventRepository;
  private final SignalRepository signalRepository;
  private final CategoryRepository categoryRepository;

  public AlertRulesEngine(
      AlertRepository alertRepository,
      AlertRulesRepository alertRulesRepository,
      RotationEventRepository rotationEventRepository,
      SignalRepository signalRepository,
      CategoryRepository categoryRepository) {
    this.alertRepository = alertRepository;
    this.alertRulesRepository = alertRulesRepository;
    this.rotationEventRepository = rotationEventRepository;
    this.signalRepository = signalRepository;
    this.categoryRepository = categoryRepository;
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

    int alertsCreated = 0;
    alertsCreated += evaluateRotationEventAlerts(signalDate);
    alertsCreated += evaluateMacroRegimeShift(signalDate);
    alertsCreated += evaluateRsAccelerationCrossover(signalDate, topLevelCategoryIds);
    alertsCreated += evaluatePersistenceLow(signalDate, equityCategoryIds);
    alertsCreated += evaluateBreadthVelocity(signalDate, equityCategoryIds);
    alertsCreated += evaluateTradeSignalTransitions(signalDate, topLevelCategoryIds);

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
          resolved += alertRepository.resolveAlertsByRuleAndCategory(RULE_TRADE_SIGNAL_BUY, categoryId);
        }
        // REDUCE alert resolves when composite recovers above 0.40
        if (composite.compareTo(new BigDecimal("0.40")) >= 0) {
          resolved += alertRepository.resolveAlertsByRuleAndCategory(RULE_TRADE_SIGNAL_REDUCE, categoryId);
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
          resolved += alertRepository.resolveAlertsByRuleAndCategory(RULE_BREADTH_VELOCITY_ACCEL, categoryId);
        }
        if (velocityPp > -BREADTH_VELOCITY_THRESHOLD_PP) {
          resolved += alertRepository.resolveAlertsByRuleAndCategory(RULE_BREADTH_VELOCITY_DECEL, categoryId);
        }
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

    boolean rrgRuleEnabled = rrgRule.map(AlertRule::enabled).orElse(false);
    boolean breakoutRuleEnabled = breakoutRule.map(AlertRule::enabled).orElse(false);
    boolean breakdownRuleEnabled = breakdownRule.map(AlertRule::enabled).orElse(false);
    Severity rrgSeverity = rrgRule.map(AlertRule::severity).orElse(Severity.INFO);
    Severity breakoutSeverity = breakoutRule.map(AlertRule::severity).orElse(Severity.ACTION);
    Severity breakdownSeverity = breakdownRule.map(AlertRule::severity).orElse(Severity.WARNING);

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
    }
    return count;
  }

  private int evaluateMacroRegimeShift(LocalDate signalDate) {
    Optional<AlertRule> macroRule = alertRulesRepository.findById(RULE_MACRO_REGIME_SHIFT);
    if (!macroRule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = macroRule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> currentRegimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, signalDate);
    if (currentRegimeSignals.isEmpty()) return 0;

    BigDecimal currentRegimeOrdinal =
        currentRegimeSignals.values().stream().findFirst().orElse(null);
    if (currentRegimeOrdinal == null) return 0;

    LocalDate previousSignalDate =
        signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, signalDate);
    if (previousSignalDate == null) return 0;

    Map<String, BigDecimal> previousRegimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, previousSignalDate);
    BigDecimal previousRegimeOrdinal =
        previousRegimeSignals.values().stream().findFirst().orElse(null);

    if (previousRegimeOrdinal != null
        && currentRegimeOrdinal.compareTo(previousRegimeOrdinal) != 0
        && !alertRepository.existsActiveAlert(RULE_MACRO_REGIME_SHIFT, null)) {

      String previousRegimeName = resolveRegimeName(previousRegimeOrdinal.intValue());
      String currentRegimeName = resolveRegimeName(currentRegimeOrdinal.intValue());

      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              null,
              RULE_MACRO_REGIME_SHIFT,
              severity,
              String.format(
                  "Macro regime shifted from %s to %s", previousRegimeName, currentRegimeName),
              String.format(
                  "{\"previousRegime\":\"%s\",\"currentRegime\":\"%s\",\"signalDate\":\"%s\"}",
                  previousRegimeName, currentRegimeName, signalDate),
              AlertStatus.ACTIVE));
      return 1;
    }
    return 0;
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

  private int evaluatePersistenceLow(LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> persistenceRule = alertRulesRepository.findById(RULE_PERSISTENCE_LOW);
    if (!persistenceRule.map(AlertRule::enabled).orElse(false)) return 0;

    AlertRule rule = persistenceRule.get();
    int threshold = rule.persistenceDays() != null ? rule.persistenceDays() : 7;
    Severity severity = rule.severity() != null ? rule.severity() : Severity.WARNING;

    Map<String, BigDecimal> persistenceSignals =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    if (persistenceSignals.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      BigDecimal persistence = persistenceSignals.get(categoryId);
      if (persistence == null) continue;

      if (persistence.intValue() < threshold) {
        if (!alertRepository.existsActiveAlert(RULE_PERSISTENCE_LOW, categoryId)) {
          CategoryId catId;
          try {
            catId = CategoryId.valueOf(categoryId);
          } catch (IllegalArgumentException e) {
            log.debug("persistence_low: skipping unknown CategoryId={}", categoryId);
            continue;
          }
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_PERSISTENCE_LOW,
                  severity,
                  String.format(
                      "%s outperformed benchmark on only %d of the last 20 trading days — persistence below threshold (%d)",
                      categoryId, persistence.intValue(), threshold),
                  String.format(
                      "{\"persistence20d\":%d,\"threshold\":%d,\"signalDate\":\"%s\"}",
                      persistence.intValue(), threshold, signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info(
              "persistence_low alert: category={} persistence={}/20 threshold={}",
              categoryId,
              persistence.intValue(),
              threshold);
        }
      }
    }
    return count;
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

  private int evaluateBreadthVelocity(LocalDate signalDate, Set<String> equityCategoryIds) {
    Optional<AlertRule> accelRule = alertRulesRepository.findById(RULE_BREADTH_VELOCITY_ACCEL);
    Optional<AlertRule> decelRule = alertRulesRepository.findById(RULE_BREADTH_VELOCITY_DECEL);

    boolean accelEnabled = accelRule.map(AlertRule::enabled).orElse(false);
    boolean decelEnabled = decelRule.map(AlertRule::enabled).orElse(false);
    if (!accelEnabled && !decelEnabled) return 0;

    Severity accelSeverity = accelRule.map(AlertRule::severity).orElse(Severity.INFO);
    Severity decelSeverity = decelRule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> persistence20d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    Map<String, BigDecimal> persistence5d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, signalDate);

    if (persistence20d.isEmpty() || persistence5d.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : equityCategoryIds) {
      BigDecimal p20 = persistence20d.get(categoryId);
      BigDecimal p5 = persistence5d.get(categoryId);
      if (p20 == null || p5 == null) continue;

      double rate5d = p5.doubleValue() / 5.0;
      double rate15 = (p20.doubleValue() - p5.doubleValue()) / 15.0;
      int velocityPp = (int) Math.round((rate5d - rate15) * 100);

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("breadth_velocity: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      if (accelEnabled && velocityPp >= BREADTH_VELOCITY_THRESHOLD_PP) {
        if (!alertRepository.existsActiveAlert(RULE_BREADTH_VELOCITY_ACCEL, categoryId)) {
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_BREADTH_VELOCITY_ACCEL,
                  accelSeverity,
                  String.format(
                      "%s breadth velocity +%dpp — recent-5d hit-rate sharply above prior-15d baseline (P5=%d, P20=%d)",
                      categoryId, velocityPp, p5.intValue(), p20.intValue()),
                  String.format(
                      "{\"velocityPp\":%d,\"persistence5d\":%d,\"persistence20d\":%d,\"signalDate\":\"%s\"}",
                      velocityPp, p5.intValue(), p20.intValue(), signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info(
              "breadth_velocity_accel: category={} velocityPp=+{} p5d={} p20d={}",
              categoryId, velocityPp, p5.intValue(), p20.intValue());
        }
      }

      if (decelEnabled && velocityPp <= -BREADTH_VELOCITY_THRESHOLD_PP) {
        if (!alertRepository.existsActiveAlert(RULE_BREADTH_VELOCITY_DECEL, categoryId)) {
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  catId,
                  RULE_BREADTH_VELOCITY_DECEL,
                  decelSeverity,
                  String.format(
                      "%s breadth velocity %dpp — recent-5d hit-rate sharply below prior-15d baseline (P5=%d, P20=%d)",
                      categoryId, velocityPp, p5.intValue(), p20.intValue()),
                  String.format(
                      "{\"velocityPp\":%d,\"persistence5d\":%d,\"persistence20d\":%d,\"signalDate\":\"%s\"}",
                      velocityPp, p5.intValue(), p20.intValue(), signalDate),
                  AlertStatus.ACTIVE));
          count++;
          log.info(
              "breadth_velocity_decel: category={} velocityPp={} p5d={} p20d={}",
              categoryId, velocityPp, p5.intValue(), p20.intValue());
        }
      }
    }
    return count;
  }

  private int evaluateTradeSignalTransitions(LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> buyRule = alertRulesRepository.findById(RULE_TRADE_SIGNAL_BUY);
    Optional<AlertRule> reduceRule = alertRulesRepository.findById(RULE_TRADE_SIGNAL_REDUCE);

    boolean buyEnabled = buyRule.map(AlertRule::enabled).orElse(false);
    boolean reduceEnabled = reduceRule.map(AlertRule::enabled).orElse(false);
    if (!buyEnabled && !reduceEnabled) return 0;

    Severity buySeverity = buyRule.map(AlertRule::severity).orElse(Severity.ACTION);
    Severity reduceSeverity = reduceRule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> composite = signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rrgQuadrant = signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> trend20d = signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> prevComposite = prevDate != null
        ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, prevDate) : Map.of();
    Map<String, BigDecimal> prevRrg = prevDate != null
        ? signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, prevDate) : Map.of();
    Map<String, BigDecimal> prevTrend = prevDate != null
        ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, prevDate) : Map.of();

    int count = 0;
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = composite.get(categoryId);
      BigDecimal rrg = rrgQuadrant.get(categoryId);
      BigDecimal trend = trend20d.get(categoryId);
      if (score == null) continue;

      int rrgInt = rrg != null ? rrg.intValue() : 0;
      boolean buyNow = score.compareTo(BUY_SCORE_THRESHOLD) >= 0
          && (rrgInt == 3 || rrgInt == 4)
          && trend != null && trend.compareTo(BigDecimal.ZERO) > 0;

      boolean reduceNow = score.compareTo(REDUCE_SCORE_THRESHOLD) < 0
          && (rrgInt == 1 || rrgInt == 2);

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
        boolean buyPrev = prevScore != null && prevScore.compareTo(BUY_SCORE_THRESHOLD) >= 0
            && (prevRrgInt == 3 || prevRrgInt == 4)
            && prevTrendVal != null && prevTrendVal.compareTo(BigDecimal.ZERO) > 0;

        if (!buyPrev && !alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId)) {
          int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
          String rrgLabel = rrgInt == 4 ? "Leading" : "Improving";
          alertRepository.insert(new Alert(
              OffsetDateTime.now(), catId, RULE_TRADE_SIGNAL_BUY, buySeverity,
              String.format("%s full BUY signal triggered: score=%d, RRG=%s, 20d trend positive — all three conditions aligned",
                  categoryId, scorePct, rrgLabel),
              String.format("{\"score\":%d,\"rrgQuadrant\":%d,\"trend20d\":%.4f,\"signalDate\":\"%s\"}",
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
        boolean reducePrev = prevScore != null && prevScore.compareTo(REDUCE_SCORE_THRESHOLD) < 0
            && (prevRrgInt == 1 || prevRrgInt == 2);

        if (!reducePrev && !alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_REDUCE, categoryId)) {
          int scorePct = score.multiply(BigDecimal.valueOf(100)).intValue();
          String rrgLabel = rrgInt == 1 ? "Lagging" : "Weakening";
          alertRepository.insert(new Alert(
              OffsetDateTime.now(), catId, RULE_TRADE_SIGNAL_REDUCE, reduceSeverity,
              String.format("%s REDUCE signal: score=%d with %s RRG — consider trimming position",
                  categoryId, scorePct, rrgLabel),
              String.format("{\"score\":%d,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                  scorePct, rrgInt, signalDate),
              AlertStatus.ACTIVE));
          count++;
          log.info("trade_signal_reduce: category={} score={} rrg={}", categoryId, scorePct, rrgLabel);
        }
      }
    }
    return count;
  }

  private String resolveRegimeName(int ordinal) {
    MacroRegime[] values = MacroRegime.values();
    return ordinal >= 0 && ordinal < values.length ? values[ordinal].name() : "UNKNOWN";
  }
}

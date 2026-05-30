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
 * <p>Implemented rules:
 * <ul>
 *   <li>rrg_transition: fires on each RRG quadrant transition (entering/leaving leading/improving)
 *   <li>composite_breakout: fires when composite score crosses above 0.70
 *   <li>composite_breakdown: fires when composite score falls below 0.35
 *   <li>macro_regime_shift: fires when MACRO_REGIME changes from the previous signal date
 *   <li>rs_accel_crossover: fires when RS-60 crosses above or below RS-120
 *   <li>persistence_low: fires when an equity sector beats its benchmark on fewer than threshold (default 7) of last 20 days; scoped to EQUITY_SECTOR to avoid spurious alerts on non-equity assets
 * </ul>
 *
 * <p>Deferred (no FLOW signals yet): flow_inflow_5d, flow_inflow_10d, flow_outflow_5d
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
  private static final int PERSISTENCE_RECOVERY_THRESHOLD = 8;

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
    Set<String> equitySectorIds =
        categoryRepository.findTopLevelActiveCategoryIdsByType(CategoryType.EQUITY_SECTOR);

    int alertsResolved = resolveStaleAlerts(signalDate, topLevelCategoryIds, equitySectorIds);

    int alertsCreated = 0;
    alertsCreated += evaluateRotationEventAlerts(signalDate);
    alertsCreated += evaluateMacroRegimeShift(signalDate);
    alertsCreated += evaluateRsAccelerationCrossover(signalDate, topLevelCategoryIds);
    alertsCreated += evaluatePersistenceLow(signalDate, equitySectorIds);

    log.info(
        "Alert rule evaluation complete: {} created, {} resolved for date={}",
        alertsCreated,
        alertsResolved,
        signalDate);
  }

  private int resolveStaleAlerts(
      LocalDate signalDate,
      Set<String> topLevelCategoryIds,
      Set<String> equitySectorIds) {
    Map<String, BigDecimal> currentComposites =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> currentPersistence =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);

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

      // Persistence alert: only relevant for equity sectors — non-equity assets
      // consistently lag SPY so persistence_low would otherwise fire spuriously.
      if (equitySectorIds.contains(categoryId)) {
        BigDecimal persistence = currentPersistence.get(categoryId);
        if (persistence != null && persistence.intValue() >= PERSISTENCE_RECOVERY_THRESHOLD) {
          resolved +=
              alertRepository.resolveAlertsByRuleAndCategory(RULE_PERSISTENCE_LOW, categoryId);
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

  private int evaluatePersistenceLow(LocalDate signalDate, Set<String> topLevelCategoryIds) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_PERSISTENCE_LOW);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    int threshold = rule.map(AlertRule::persistenceDays).filter(d -> d != null).orElse(7);

    Map<String, BigDecimal> currentPersistence =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    if (currentPersistence.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal persistenceValue = currentPersistence.get(categoryId);
      if (persistenceValue == null) continue;

      int days = persistenceValue.intValue();
      if (days >= threshold) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("persistence_low: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      if (!alertRepository.existsActiveAlert(RULE_PERSISTENCE_LOW, categoryId)) {
        String message = String.format(
            "%s outperformed its benchmark on only %d of the last 20 trading days — breadth of outperformance is deteriorating",
            categoryId, days);
        String snapshot = String.format(
            "{\"persistence20d\":%d,\"threshold\":%d,\"signalDate\":\"%s\"}",
            days, threshold, signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_PERSISTENCE_LOW,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        count++;
        log.info("persistence_low alert: category={} days={} threshold={}", categoryId, days, threshold);
      }
    }
    return count;
  }

  private String resolveRegimeName(int ordinal) {
    MacroRegime[] values = MacroRegime.values();
    return ordinal >= 0 && ordinal < values.length ? values[ordinal].name() : "UNKNOWN";
  }
}

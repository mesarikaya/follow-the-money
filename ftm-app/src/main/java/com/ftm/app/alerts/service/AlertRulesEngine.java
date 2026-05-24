package com.ftm.app.alerts.service;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.*;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import com.ftm.app.signals.repository.RotationEventRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
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
  private static final String RULE_MACRO_REGIME_SHIFT = "macro_regime_shift";
  private static final String RULE_RS_ACCEL_CROSSOVER = "rs_accel_crossover";

  private final AlertRepository alertRepository;
  private final AlertRulesRepository alertRulesRepository;
  private final RotationEventRepository rotationEventRepository;
  private final SignalRepository signalRepository;

  public AlertRulesEngine(
      AlertRepository alertRepository,
      AlertRulesRepository alertRulesRepository,
      RotationEventRepository rotationEventRepository,
      SignalRepository signalRepository) {
    this.alertRepository = alertRepository;
    this.alertRulesRepository = alertRulesRepository;
    this.rotationEventRepository = rotationEventRepository;
    this.signalRepository = signalRepository;
  }

  @EventListener
  @Async("asyncExecutor")
  public void onSignalsUpdated(SignalsUpdatedEvent event) {
    LocalDate signalDate = event.signalDate();
    log.info("Evaluating alert rules for signal_date={}", signalDate);

    int alertsCreated = 0;
    alertsCreated += evaluateRotationEventAlerts(signalDate);
    alertsCreated += evaluateMacroRegimeShift(signalDate);
    alertsCreated += evaluateRsAccelerationCrossover(signalDate);

    log.info(
        "Alert rule evaluation complete: {} alerts created for date={}", alertsCreated, signalDate);
  }

  private int evaluateRotationEventAlerts(LocalDate signalDate) {
    List<RotationEvent> recentRotationEvents = rotationEventRepository.findRecentEvents(signalDate);
    List<RotationEvent> todaysEvents =
        recentRotationEvents.stream().filter(e -> e.detectedDate().equals(signalDate)).toList();

    boolean rrgRuleEnabled =
        alertRulesRepository.findById(RULE_RRG_TRANSITION).map(AlertRule::enabled).orElse(false);
    boolean breakoutRuleEnabled =
        alertRulesRepository
            .findById(RULE_COMPOSITE_BREAKOUT)
            .map(AlertRule::enabled)
            .orElse(false);
    Severity rrgSeverity =
        alertRulesRepository
            .findById(RULE_RRG_TRANSITION)
            .map(AlertRule::severity)
            .orElse(Severity.INFO);
    Severity breakoutSeverity =
        alertRulesRepository
            .findById(RULE_COMPOSITE_BREAKOUT)
            .map(AlertRule::severity)
            .orElse(Severity.ACTION);

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
          alertRepository.insert(
              new Alert(
                  OffsetDateTime.now(),
                  rotationEvent.categoryId(),
                  RULE_COMPOSITE_BREAKOUT,
                  breakoutSeverity,
                  String.format(
                      "%s composite score crossed breakout threshold (confidence: %d%%)",
                      categoryId, Math.round(rotationEvent.confidence().doubleValue() * 100)),
                  buildBreakoutSnapshot(rotationEvent),
                  AlertStatus.ACTIVE));
          count++;
        }
      }
    }
    return count;
  }

  private int evaluateMacroRegimeShift(LocalDate signalDate) {
    boolean macroRuleEnabled =
        alertRulesRepository
            .findById(RULE_MACRO_REGIME_SHIFT)
            .map(AlertRule::enabled)
            .orElse(false);
    if (!macroRuleEnabled) return 0;

    Severity severity =
        alertRulesRepository
            .findById(RULE_MACRO_REGIME_SHIFT)
            .map(AlertRule::severity)
            .orElse(Severity.WARNING);

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
          case ENTERING_LEADING   -> "entered Leading quadrant (Improving → Leading)";
          case ENTERING_WEAKENING -> "entered Weakening quadrant (Leading → Weakening) — rotation peak";
          case ENTERING_LAGGING   -> "entered Lagging quadrant (Weakening → Lagging) — losing relative strength";
          default                 -> "entered Improving quadrant (Lagging → Improving)";
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

  private int evaluateRsAccelerationCrossover(LocalDate signalDate) {
    boolean ruleEnabled =
        alertRulesRepository.findById(RULE_RS_ACCEL_CROSSOVER).map(AlertRule::enabled).orElse(false);
    if (!ruleEnabled) return 0;

    Severity severity =
        alertRulesRepository.findById(RULE_RS_ACCEL_CROSSOVER).map(AlertRule::severity).orElse(Severity.INFO);

    Map<String, BigDecimal> currentRs60 =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    Map<String, BigDecimal> currentRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate);
    if (currentRs60.isEmpty() || currentRs120.isEmpty()) return 0;

    LocalDate prevDate = signalRepository.findPreviousSignalDate(SignalType.RS_60, signalDate);
    if (prevDate == null) return 0;

    Map<String, BigDecimal> prevRs60 = signalRepository.findByTypeAndDate(SignalType.RS_60, prevDate);
    Map<String, BigDecimal> prevRs120 =
        signalRepository.findByTypeAndDate(SignalType.RS_120, prevDate);

    int count = 0;
    for (String categoryId : currentRs60.keySet()) {
      if (categoryId.contains("_")) continue; // skip sub-sectors — parent sectors only
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

  private String resolveRegimeName(int ordinal) {
    return switch (ordinal) {
      case 0 -> "STAGFLATION";
      case 1 -> "RISK_OFF_FLIGHT";
      case 2 -> "RISK_ON_GROWTH";
      case 3 -> "RISK_ON_DEFENSIVE";
      default -> "UNKNOWN";
    };
  }
}

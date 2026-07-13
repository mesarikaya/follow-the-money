package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import com.ftm.app.domain.Severity;
import com.ftm.app.signals.repository.RotationEventRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Raises an alert for each rotation event the detector recorded today: a category crossing into a
 * new quadrant of the rotation graph, a composite score breaking out or breaking down, or an unusual
 * surge of flow. Each of the four is its own configurable rule, so they are enabled and graded
 * independently — they are evaluated together only because they read the same event feed.
 *
 * <p>These alerts are resolved centrally by the engine, not here.
 */
@Component
public class RotationEventAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(RotationEventAlertEvaluator.class);

  // Copies of the engine's rule ids: the engine still owns resolving these alerts, so the constants
  // live in both places on purpose.
  private static final String RULE_RRG_TRANSITION = "rrg_transition";
  private static final String RULE_COMPOSITE_BREAKOUT = "composite_breakout";
  private static final String RULE_COMPOSITE_BREAKDOWN = "composite_breakdown";
  private static final String RULE_FLOW_SURGE = "flow_surge";

  private final AlertRulesRepository alertRulesRepository;
  private final AlertRepository alertRepository;
  private final RotationEventRepository rotationEventRepository;

  public RotationEventAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      AlertRepository alertRepository,
      RotationEventRepository rotationEventRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.alertRepository = alertRepository;
    this.rotationEventRepository = rotationEventRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    LocalDate signalDate = context.signalDate();
    List<RotationEvent> todaysEvents =
        rotationEventRepository.findRecentEvents(signalDate).stream()
            .filter(event -> event.detectedDate().equals(signalDate))
            .toList();

    Rule rrgTransition = ruleFor(RULE_RRG_TRANSITION, Severity.INFO);
    Rule compositeBreakout = ruleFor(RULE_COMPOSITE_BREAKOUT, Severity.ACTION);
    Rule compositeBreakdown = ruleFor(RULE_COMPOSITE_BREAKDOWN, Severity.WARNING);
    Rule flowSurge = ruleFor(RULE_FLOW_SURGE, Severity.INFO);

    int alertsCreated = 0;
    for (RotationEvent event : todaysEvents) {
      if (isQuadrantTransition(event.eventType())) {
        alertsCreated += raiseOnce(rrgTransition, event, quadrantTransitionMessage(event));
      }
      if (event.eventType() == RotationEventType.COMPOSITE_BREAKOUT) {
        alertsCreated += raiseOnce(compositeBreakout, event, breakoutMessage(event));
      }
      if (event.eventType() == RotationEventType.COMPOSITE_BREAKDOWN) {
        alertsCreated += raiseOnce(compositeBreakdown, event, breakdownMessage(event));
      }
      if (event.eventType() == RotationEventType.FLOW_SURGE) {
        int created = raiseOnce(flowSurge, event, flowSurgeMessage(event), event.signalSnapshot());
        if (created > 0) {
          log.info(
              "flow_surge alert: category={} signalDate={}",
              event.categoryId().name(),
              signalDate);
        }
        alertsCreated += created;
      }
    }
    return alertsCreated;
  }

  /** One of the four configurable rules, resolved once per evaluation. */
  private record Rule(String ruleId, boolean enabled, Severity severity) {}

  private Rule ruleFor(String ruleId, Severity defaultSeverity) {
    Optional<AlertRule> rule = alertRulesRepository.findById(ruleId);
    return new Rule(
        ruleId,
        rule.map(AlertRule::enabled).orElse(false),
        rule.map(AlertRule::severity).orElse(defaultSeverity));
  }

  private int raiseOnce(Rule rule, RotationEvent event, String message) {
    return raiseOnce(rule, event, message, snapshotOf(event));
  }

  /** Raises the alert unless the rule is off or the category already has one active. */
  private int raiseOnce(Rule rule, RotationEvent event, String message, String snapshot) {
    if (!rule.enabled()) return 0;
    String categoryId = event.categoryId().name();
    if (alertRepository.existsActiveAlert(rule.ruleId(), categoryId)) return 0;

    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            event.categoryId(),
            rule.ruleId(),
            rule.severity(),
            message,
            snapshot,
            AlertStatus.ACTIVE));
    return 1;
  }

  private static boolean isQuadrantTransition(RotationEventType eventType) {
    return eventType == RotationEventType.ENTERING_IMPROVING
        || eventType == RotationEventType.ENTERING_LEADING
        || eventType == RotationEventType.ENTERING_WEAKENING
        || eventType == RotationEventType.ENTERING_LAGGING;
  }

  private static String quadrantTransitionMessage(RotationEvent event) {
    String transition =
        switch (event.eventType()) {
          case ENTERING_LEADING -> "entered Leading quadrant (Improving → Leading)";
          case ENTERING_WEAKENING -> "entered Weakening quadrant (Leading → Weakening) — rotation peak";
          case ENTERING_LAGGING ->
              "entered Lagging quadrant (Weakening → Lagging) — losing relative strength";
          default -> "entered Improving quadrant — strengthening momentum";
        };
    return String.format("%s %s", event.categoryId().name(), transition);
  }

  private static String breakoutMessage(RotationEvent event) {
    int scorePercent = Math.round(event.confidence().floatValue() * 100);
    return String.format(
        "%s composite score reached %d — crossed breakout threshold (70)",
        event.categoryId().name(), scorePercent);
  }

  private static String breakdownMessage(RotationEvent event) {
    long scorePercent = Math.round((1.0 - event.confidence().doubleValue()) * 100);
    return String.format(
        "%s composite score fell to %d — crossed REDUCE threshold (35)",
        event.categoryId().name(), scorePercent);
  }

  private static String flowSurgeMessage(RotationEvent event) {
    return String.format(
        "%s flow z-score crossed 2σ — unusual institutional inflow activity detected",
        event.categoryId().name());
  }

  private static String snapshotOf(RotationEvent event) {
    return String.format(
        "{\"eventType\":\"%s\",\"confidence\":%.3f,\"detectedDate\":\"%s\"}",
        event.eventType().name(), event.confidence(), event.detectedDate());
  }
}

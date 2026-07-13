package com.ftm.app.alerts.evaluator;

import static com.ftm.app.alerts.evaluator.ThemePriorPhaseSignals.UNKNOWN_PHASE;
import static com.ftm.app.alerts.evaluator.ThemeSignalReader.average;
import static com.ftm.app.alerts.evaluator.ThemeSignalReader.averageOrNull;
import static com.ftm.app.alerts.evaluator.ThemeSignalReader.phaseOf;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires the first time a theme enters the FADING phase — a middling or weak score with a negative
 * 20-day trend. A theme that was already fading a trading week ago is not news, so only the entry
 * raises an alert. Resolves as soon as the theme is no longer fading.
 */
@Component
public class ThemePhaseFadingAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ThemePhaseFadingAlertEvaluator.class);

  private static final String RULE_THEME_PHASE_FADING = "theme_phase_fading";
  private static final String FADING = "FADING";

  private final AlertRulesRepository alertRulesRepository;
  private final AlertRepository alertRepository;
  private final ThemeSignalReader themeSignalReader;

  public ThemePhaseFadingAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      AlertRepository alertRepository,
      ThemeSignalReader themeSignalReader) {
    this.alertRulesRepository = alertRulesRepository;
    this.alertRepository = alertRepository;
    this.themeSignalReader = themeSignalReader;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_PHASE_FADING);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeSignalReader.constituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composites =
        themeSignalReader.signalsAt(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trends5d =
        themeSignalReader.signalsAt(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> trends20d =
        themeSignalReader.signalsAt(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (composites.isEmpty()) return 0;

    ThemePriorPhaseSignals priorSignals =
        new ThemePriorPhaseSignals(themeSignalReader, signalDate);

    int alertsCreated = 0;
    for (Map.Entry<String, List<String>> theme : constituentsByTheme.entrySet()) {
      String themeId = theme.getKey();
      List<String> categoryIds = theme.getValue();
      if (categoryIds.isEmpty()) continue;

      OptionalDouble score = average(categoryIds, composites);
      if (score.isEmpty()) continue;

      String currentPhase =
          phaseOf(
              score.getAsDouble(),
              averageOrNull(categoryIds, trends5d),
              averageOrNull(categoryIds, trends20d));
      boolean hasActiveAlert =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_PHASE_FADING, themeId);

      if (FADING.equals(currentPhase) && !hasActiveAlert) {
        String priorPhase = priorSignals.phaseOf(categoryIds);
        if (!FADING.equals(priorPhase)) {
          String fromPhase = priorSignals.hasScoreFor(categoryIds) ? priorPhase : UNKNOWN_PHASE;
          raise(rule, themeId, signalDate, score.getAsDouble(), fromPhase);
          alertsCreated++;
        }
      } else if (hasActiveAlert && !FADING.equals(currentPhase)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_PHASE_FADING, themeId);
        log.info("theme_phase_fading: resolved theme={} (phase now {})", themeId, currentPhase);
      }
    }
    return alertsCreated;
  }

  private void raise(
      Optional<AlertRule> rule,
      String themeId,
      LocalDate signalDate,
      double score,
      String fromPhase) {

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    int scorePercent = (int) Math.round(score * 100);

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
                themeId, fromPhase, scorePercent),
            String.format(
                "{\"themeId\":\"%s\",\"priorPhase\":\"%s\",\"score\":%.4f,\"signalDate\":\"%s\"}",
                themeId, fromPhase, score, signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info("theme_phase_fading: theme={} priorPhase={} score={}", themeId, fromPhase, scorePercent);
  }
}

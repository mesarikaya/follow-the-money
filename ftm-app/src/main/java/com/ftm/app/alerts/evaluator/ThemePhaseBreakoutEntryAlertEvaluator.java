package com.ftm.app.alerts.evaluator;

import static com.ftm.app.alerts.evaluator.ThemeSignalReader.PHASE_LOOKBACK_DAYS;
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
 * Fires the first time a theme enters the BREAKOUT phase — a strong score whose 5-day trend is
 * pulling away from its 20-day trend. Only the *entry* is interesting, so a theme that was already
 * in BREAKOUT a trading week ago is ignored. Resolves once the theme drops out of BREAKOUT and
 * MOMENTUM alike.
 */
@Component
public class ThemePhaseBreakoutEntryAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemePhaseBreakoutEntryAlertEvaluator.class);

  private static final String RULE_THEME_PHASE_BREAKOUT_ENTRY = "theme_phase_breakout_entry";
  private static final String BREAKOUT = "BREAKOUT";
  private static final String MOMENTUM = "MOMENTUM";

  private final AlertRulesRepository alertRulesRepository;
  private final AlertRepository alertRepository;
  private final ThemeSignalReader themeSignalReader;

  public ThemePhaseBreakoutEntryAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      AlertRepository alertRepository,
      ThemeSignalReader themeSignalReader) {
    this.alertRulesRepository = alertRulesRepository;
    this.alertRepository = alertRepository;
    this.themeSignalReader = themeSignalReader;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_PHASE_BREAKOUT_ENTRY);
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

    // The prior week's signals cost three queries, so they are loaded only once a theme is actually
    // found in BREAKOUT — usually never.
    ThemePriorPhaseSignals priorSignals =
        new ThemePriorPhaseSignals(themeSignalReader, signalDate);

    int alertsCreated = 0;
    for (Map.Entry<String, List<String>> theme : constituentsByTheme.entrySet()) {
      String themeId = theme.getKey();
      List<String> categoryIds = theme.getValue();
      if (categoryIds.isEmpty()) continue;

      OptionalDouble score = average(categoryIds, composites);
      if (score.isEmpty()) continue;

      Double trend5d = averageOrNull(categoryIds, trends5d);
      Double trend20d = averageOrNull(categoryIds, trends20d);
      String currentPhase = phaseOf(score.getAsDouble(), trend5d, trend20d);
      boolean hasActiveAlert =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_PHASE_BREAKOUT_ENTRY, themeId);

      if (BREAKOUT.equals(currentPhase) && !hasActiveAlert) {
        String priorPhase = priorSignals.phaseOf(categoryIds);
        if (!BREAKOUT.equals(priorPhase)) {
          raise(rule, themeId, signalDate, score.getAsDouble(), trend5d, trend20d, priorPhase);
          alertsCreated++;
        }
      } else if (hasActiveAlert
          && !BREAKOUT.equals(currentPhase)
          && !MOMENTUM.equals(currentPhase)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_PHASE_BREAKOUT_ENTRY, themeId);
        log.info(
            "theme_phase_breakout_entry: resolved theme={} (phase now {})", themeId, currentPhase);
      }
    }
    return alertsCreated;
  }

  private void raise(
      Optional<AlertRule> rule,
      String themeId,
      LocalDate signalDate,
      double score,
      Double trend5d,
      Double trend20d,
      String priorPhase) {

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
    int scorePercent = (int) Math.round(score * 100);
    double acceleration = trend5d != null && trend20d != null ? trend5d - trend20d : 0;

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
                themeId, priorPhase, scorePercent, (int) Math.round(acceleration * 100)),
            String.format(
                "{\"themeId\":\"%s\",\"priorPhase\":\"%s\",\"score\":%.4f,\"delta5d20d\":%.4f,\"signalDate\":\"%s\"}",
                themeId, priorPhase, score, acceleration, signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_phase_breakout_entry: theme={} priorPhase={} score={}",
        themeId,
        priorPhase,
        scorePercent);
  }
}

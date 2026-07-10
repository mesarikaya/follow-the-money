package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.themes.repository.ThemeRepository;
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
 * Fires per theme when its average score has dropped out of BUY territory (was ≥0.65 five trading
 * days ago, now below 0.57) — a failed breakout, favouring exits over new entries. Resolves when the
 * score recovers above 0.62.
 */
@Component
public class ThemeFailedBreakoutAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ThemeFailedBreakoutAlertEvaluator.class);

  private static final String RULE_THEME_FAILED_BREAKOUT = "theme_failed_breakout";
  private static final int THEME_PHASE_LOOKBACK_DAYS = 5;
  private static final double THEME_FAILED_BREAKOUT_DROP_BELOW = 0.57;
  private static final double THEME_FAILED_BREAKOUT_WAS_ABOVE = 0.65;
  private static final double THEME_FAILED_BREAKOUT_RESOLVE_ABOVE = 0.62;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeFailedBreakoutAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      ThemeRepository themeRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.themeRepository = themeRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_FAILED_BREAKOUT);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> currentComposite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (currentComposite.isEmpty()) return 0;

    boolean priorDataLoaded = false;
    Map<String, BigDecimal> priorComposite = Map.of();

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

      double score = avgCurrentScore.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_FAILED_BREAKOUT, themeId);

      if (score < THEME_FAILED_BREAKOUT_DROP_BELOW && !hasActive) {
        if (!priorDataLoaded) {
          LocalDate priorDate =
              findNthPreviousSignalDate(SignalType.COMPOSITE, signalDate, THEME_PHASE_LOOKBACK_DAYS);
          if (priorDate != null) {
            priorComposite = signalRepository.findByTypeAndDate(SignalType.COMPOSITE, priorDate);
          }
          priorDataLoaded = true;
        }

        OptionalDouble avgPriorScore =
            ids.stream()
                .map(priorComposite::get)
                .filter(v -> v != null)
                .mapToDouble(BigDecimal::doubleValue)
                .average();

        if (avgPriorScore.isPresent()
            && avgPriorScore.getAsDouble() >= THEME_FAILED_BREAKOUT_WAS_ABOVE) {
          Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
          int currentPct = (int) Math.round(score * 100);
          int priorPct = (int) Math.round(avgPriorScore.getAsDouble() * 100);
          int dropPts = priorPct - currentPct;
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_FAILED_BREAKOUT,
                  severity,
                  String.format(
                      "%s failed breakout: dropped %dpt (%d→%d) in %dd — exits favored over new entries",
                      themeId, dropPts, priorPct, currentPct, THEME_PHASE_LOOKBACK_DAYS),
                  String.format(
                      "{\"themeId\":\"%s\",\"priorScore\":%.4f,\"currentScore\":%.4f,\"dropPts\":%d,\"signalDate\":\"%s\"}",
                      themeId, avgPriorScore.getAsDouble(), score, dropPts, signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info(
              "theme_failed_breakout: theme={} prior={}pt current={}pt drop={}pt",
              themeId,
              priorPct,
              currentPct,
              dropPts);
        }
      } else if (hasActive && score >= THEME_FAILED_BREAKOUT_RESOLVE_ABOVE) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_FAILED_BREAKOUT, themeId);
        log.info(
            "theme_failed_breakout: resolved theme={} (score recovered to {})",
            themeId,
            (int) Math.round(score * 100));
      }
    }
    return count;
  }

  /** The signal date {@code n} steps before {@code date}, or null if history runs out first. */
  private LocalDate findNthPreviousSignalDate(SignalType type, LocalDate date, int n) {
    LocalDate result = date;
    for (int i = 0; i < n; i++) {
      result = signalRepository.findPreviousSignalDate(type, result);
      if (result == null) return null;
    }
    return result;
  }
}

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
 * Fires when a theme confirms a strong breakout: its average composite is above the BUY threshold
 * today, having been below it ~20 trading days ago — i.e. institutional follow-through, not a
 * one-day spike. Resolves when the score falls back below the BUY threshold.
 */
@Component
public class ThemeStrongBreakoutAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeStrongBreakoutAlertEvaluator.class);

  private static final String RULE_THEME_STRONG_BREAKOUT = "theme_strong_breakout_confirmation";
  private static final double THEME_STRONG_BREAKOUT_FIRE_SCORE = 0.70;
  private static final double THEME_STRONG_BREAKOUT_PRIOR_MAX_SCORE = 0.65;
  private static final double THEME_STRONG_BREAKOUT_RESOLVE_SCORE = 0.65;
  private static final int THEME_STRONG_BREAKOUT_LOOKBACK = 20;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeStrongBreakoutAlertEvaluator(
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

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_STRONG_BREAKOUT);
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

      OptionalDouble avgScore =
          ids.stream()
              .map(currentComposite::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avgScore.isEmpty()) continue;

      double score = avgScore.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_STRONG_BREAKOUT, themeId);

      if (score >= THEME_STRONG_BREAKOUT_FIRE_SCORE && !hasActive) {
        if (!priorDataLoaded) {
          LocalDate priorDate =
              findNthPreviousSignalDate(
                  SignalType.COMPOSITE, signalDate, THEME_STRONG_BREAKOUT_LOOKBACK);
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

        boolean priorWasBelowBuy =
            avgPriorScore.isPresent()
                && avgPriorScore.getAsDouble() < THEME_STRONG_BREAKOUT_PRIOR_MAX_SCORE;

        if (priorWasBelowBuy) {
          Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
          int scorePct = (int) Math.round(score * 100);
          int priorPct = (int) Math.round(avgPriorScore.getAsDouble() * 100);
          alertRepository.insert(
              new Alert(
                  null,
                  OffsetDateTime.now(),
                  null,
                  themeId,
                  RULE_THEME_STRONG_BREAKOUT,
                  severity,
                  String.format(
                      "%s strong breakout confirmed: score %d (was %d 20 days ago) — institutional follow-through above BUY threshold",
                      themeId, scorePct, priorPct),
                  String.format(
                      "{\"themeId\":\"%s\",\"score\":%.4f,\"priorScore\":%.4f,\"signalDate\":\"%s\"}",
                      themeId, score, avgPriorScore.getAsDouble(), signalDate),
                  AlertStatus.ACTIVE,
                  null,
                  null));
          count++;
          log.info(
              "theme_strong_breakout_confirmation: theme={} score={} priorScore={}",
              themeId,
              scorePct,
              priorPct);
        }
      } else if (hasActive && score < THEME_STRONG_BREAKOUT_RESOLVE_SCORE) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_STRONG_BREAKOUT, themeId);
        log.info(
            "theme_strong_breakout_confirmation: resolved theme={} (score={})",
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

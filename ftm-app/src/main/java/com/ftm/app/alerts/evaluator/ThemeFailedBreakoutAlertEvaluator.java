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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_FAILED_BREAKOUT);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> current =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (constituentsByTheme.isEmpty() || current.isEmpty()) {
      return 0;
    }

    Map<String, BigDecimal> prior = loadPriorComposite(signalDate);
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<Breakdown> breakdowns =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), current, prior))
            .flatMap(Optional::stream)
            .toList();

    breakdowns.stream().filter(Breakdown::shouldFire).forEach(b -> fire(b, severity, signalDate));
    breakdowns.stream().filter(Breakdown::shouldResolve).forEach(this::resolve);
    return (int) breakdowns.stream().filter(Breakdown::shouldFire).count();
  }

  private Optional<Breakdown> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> current,
      Map<String, BigDecimal> prior) {
    OptionalDouble avgCurrent = averageOf(constituentIds, current);
    if (avgCurrent.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avgPrior = averageOf(constituentIds, prior);
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_FAILED_BREAKOUT, themeId);
    Double priorScore = avgPrior.isPresent() ? avgPrior.getAsDouble() : null;
    return Optional.of(new Breakdown(themeId, avgCurrent.getAsDouble(), priorScore, active));
  }

  private OptionalDouble averageOf(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream()
        .map(values::get)
        .filter(value -> value != null)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  private void fire(Breakdown breakdown, Severity severity, LocalDate signalDate) {
    String themeId = breakdown.themeId();
    int currentPct = breakdown.currentPercent();
    int priorPct = breakdown.priorPercent();
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
                themeId, breakdown.priorScore(), breakdown.currentScore(), dropPts, signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_failed_breakout: theme={} prior={}pt current={}pt drop={}pt",
        themeId,
        priorPct,
        currentPct,
        dropPts);
  }

  private void resolve(Breakdown breakdown) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_FAILED_BREAKOUT, breakdown.themeId());
    log.info(
        "theme_failed_breakout: resolved theme={} (score recovered to {})",
        breakdown.themeId(),
        breakdown.currentPercent());
  }

  private Map<String, BigDecimal> loadPriorComposite(LocalDate signalDate) {
    LocalDate priorDate =
        findNthPreviousSignalDate(SignalType.COMPOSITE, signalDate, THEME_PHASE_LOOKBACK_DAYS);
    return priorDate != null
        ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, priorDate)
        : Map.of();
  }

  /** The signal date {@code n} steps before {@code date}, or null if history runs out first. */
  private LocalDate findNthPreviousSignalDate(SignalType type, LocalDate date, int n) {
    LocalDate result = date;
    for (int i = 0; i < n; i++) {
      result = signalRepository.findPreviousSignalDate(type, result);
      if (result == null) {
        return null;
      }
    }
    return result;
  }

  /** A theme's breakdown reading: today's score vs its score ~5 days ago. */
  private record Breakdown(String themeId, double currentScore, Double priorScore, boolean hasActiveAlert) {

    int currentPercent() {
      return (int) Math.round(currentScore * 100);
    }

    int priorPercent() {
      return (int) Math.round(priorScore * 100);
    }

    boolean shouldFire() {
      return currentScore < THEME_FAILED_BREAKOUT_DROP_BELOW
          && !hasActiveAlert
          && priorScore != null
          && priorScore >= THEME_FAILED_BREAKOUT_WAS_ABOVE;
    }

    boolean shouldResolve() {
      return hasActiveAlert && currentScore >= THEME_FAILED_BREAKOUT_RESOLVE_ABOVE;
    }
  }
}

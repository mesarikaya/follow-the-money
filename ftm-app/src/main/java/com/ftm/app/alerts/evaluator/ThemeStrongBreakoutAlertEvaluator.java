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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_STRONG_BREAKOUT);
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
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
    List<Breakout> breakouts =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), current, prior))
            .flatMap(Optional::stream)
            .toList();

    breakouts.stream().filter(Breakout::shouldFire).forEach(b -> fire(b, severity, signalDate));
    breakouts.stream().filter(Breakout::shouldResolve).forEach(this::resolve);
    return (int) breakouts.stream().filter(Breakout::shouldFire).count();
  }

  private Optional<Breakout> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> current,
      Map<String, BigDecimal> prior) {
    OptionalDouble avgScore = averageOf(constituentIds, current);
    if (avgScore.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avgPrior = averageOf(constituentIds, prior);
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_STRONG_BREAKOUT, themeId);
    Double priorScore = avgPrior.isPresent() ? avgPrior.getAsDouble() : null;
    return Optional.of(new Breakout(themeId, avgScore.getAsDouble(), priorScore, active));
  }

  private OptionalDouble averageOf(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream()
        .map(values::get)
        .filter(value -> value != null)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  private void fire(Breakout breakout, Severity severity, LocalDate signalDate) {
    String themeId = breakout.themeId();
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
                themeId, breakout.scorePercent(), breakout.priorPercent()),
            String.format(
                "{\"themeId\":\"%s\",\"score\":%.4f,\"priorScore\":%.4f,\"signalDate\":\"%s\"}",
                themeId, breakout.score(), breakout.priorScore(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_strong_breakout_confirmation: theme={} score={} priorScore={}",
        themeId,
        breakout.scorePercent(),
        breakout.priorPercent());
  }

  private void resolve(Breakout breakout) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_STRONG_BREAKOUT, breakout.themeId());
    log.info(
        "theme_strong_breakout_confirmation: resolved theme={} (score={})",
        breakout.themeId(),
        breakout.scorePercent());
  }

  private Map<String, BigDecimal> loadPriorComposite(LocalDate signalDate) {
    LocalDate priorDate =
        findNthPreviousSignalDate(SignalType.COMPOSITE, signalDate, THEME_STRONG_BREAKOUT_LOOKBACK);
    return priorDate != null
        ? signalRepository.findByTypeAndDate(SignalType.COMPOSITE, priorDate)
        : Map.of();
  }

  /** A theme's breakout reading: today's score vs its score ~20 days ago. */
  private record Breakout(String themeId, double score, Double priorScore, boolean hasActiveAlert) {

    int scorePercent() {
      return (int) Math.round(score * 100);
    }

    int priorPercent() {
      return (int) Math.round(priorScore * 100);
    }

    boolean shouldFire() {
      return score >= THEME_STRONG_BREAKOUT_FIRE_SCORE
          && !hasActiveAlert
          && priorScore != null
          && priorScore < THEME_STRONG_BREAKOUT_PRIOR_MAX_SCORE;
    }

    boolean shouldResolve() {
      return hasActiveAlert && score < THEME_STRONG_BREAKOUT_RESOLVE_SCORE;
    }
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

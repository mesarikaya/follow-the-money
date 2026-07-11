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
 * Fires per theme when its average score is still in BUY territory but both its 5-day and 20-day
 * velocities have turned negative — momentum exhausting under a strong headline score, a "reduce"
 * warning. Resolves when the score cools or the short-term trend recovers.
 */
@Component
public class ThemeMomentumExhaustionAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeMomentumExhaustionAlertEvaluator.class);

  private static final String RULE_THEME_MOMENTUM_EXHAUSTION = "theme_momentum_exhaustion";
  private static final double THEME_EXHAUSTION_MIN_SCORE = 0.65;
  private static final double THEME_EXHAUSTION_MAX_5D = -0.005;
  private static final double THEME_EXHAUSTION_MAX_20D = 0.0;
  private static final double THEME_EXHAUSTION_RESOLVE_5D = 0.002;
  private static final double THEME_EXHAUSTION_RESOLVE_SCORE = 0.60;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeMomentumExhaustionAlertEvaluator(
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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_MOMENTUM_EXHAUSTION);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> trend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (constituentsByTheme.isEmpty() || composite.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<Exhaustion> exhaustions =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), composite, trend5d, trend20d))
            .flatMap(Optional::stream)
            .toList();

    exhaustions.stream().filter(Exhaustion::shouldFire).forEach(e -> fire(e, severity, signalDate));
    exhaustions.stream().filter(Exhaustion::shouldResolve).forEach(this::resolve);
    return (int) exhaustions.stream().filter(Exhaustion::shouldFire).count();
  }

  private Optional<Exhaustion> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> trend5d,
      Map<String, BigDecimal> trend20d) {
    if (constituentIds.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avgComposite = averageOf(constituentIds, composite);
    OptionalDouble avgTrend5d = averageOf(constituentIds, trend5d);
    OptionalDouble avgTrend20d = averageOf(constituentIds, trend20d);
    if (avgComposite.isEmpty() || avgTrend5d.isEmpty() || avgTrend20d.isEmpty()) {
      return Optional.empty();
    }
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_MOMENTUM_EXHAUSTION, themeId);
    return Optional.of(
        new Exhaustion(
            themeId, avgComposite.getAsDouble(), avgTrend5d.getAsDouble(), avgTrend20d.getAsDouble(), active));
  }

  private OptionalDouble averageOf(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream()
        .map(values::get)
        .filter(value -> value != null)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  private void fire(Exhaustion exhaustion, Severity severity, LocalDate signalDate) {
    String themeId = exhaustion.themeId();
    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            RULE_THEME_MOMENTUM_EXHAUSTION,
            severity,
            String.format(
                "%s momentum exhaustion: score %d (BUY zone) but 5d=%.1fpt/day, 20d=%.1fpt/day — both trends negative, consider reducing",
                themeId, exhaustion.scorePercent(), exhaustion.trend5d() * 100, exhaustion.trend20d() * 100),
            String.format(
                "{\"themeId\":\"%s\",\"score\":%.4f,\"trend5d\":%.4f,\"trend20d\":%.4f,\"signalDate\":\"%s\"}",
                themeId, exhaustion.score(), exhaustion.trend5d(), exhaustion.trend20d(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_momentum_exhaustion: theme={} score={} trend5d={} trend20d={}",
        themeId,
        exhaustion.scorePercent(),
        String.format("%.3f", exhaustion.trend5d()),
        String.format("%.3f", exhaustion.trend20d()));
  }

  private void resolve(Exhaustion exhaustion) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_MOMENTUM_EXHAUSTION, exhaustion.themeId());
    log.info(
        "theme_momentum_exhaustion: resolved theme={} (score={} trend5d={})",
        exhaustion.themeId(),
        exhaustion.scorePercent(),
        String.format("%.3f", exhaustion.trend5d()));
  }

  /** A theme's average score-vs-trend reading for the day. */
  private record Exhaustion(
      String themeId, double score, double trend5d, double trend20d, boolean hasActiveAlert) {

    int scorePercent() {
      return (int) Math.round(score * 100);
    }

    boolean shouldFire() {
      return score >= THEME_EXHAUSTION_MIN_SCORE
          && trend5d < THEME_EXHAUSTION_MAX_5D
          && trend20d < THEME_EXHAUSTION_MAX_20D
          && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return hasActiveAlert
          && (score < THEME_EXHAUSTION_RESOLVE_SCORE || trend5d > THEME_EXHAUSTION_RESOLVE_5D);
    }
  }
}

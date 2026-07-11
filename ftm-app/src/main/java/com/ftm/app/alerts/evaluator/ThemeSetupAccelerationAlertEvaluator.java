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
 * Fires per theme when it is in the SETUP band (avg score 0.52–0.64) and its 5-day trend is strongly
 * up — a pre-breakout early-entry heads-up, before the theme actually crosses into BUY territory.
 * Resolves when it breaks into BUY (0.65+) or the setup fails (score or trend falls back).
 */
@Component
public class ThemeSetupAccelerationAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeSetupAccelerationAlertEvaluator.class);

  private static final String RULE_THEME_SETUP_ACCELERATION = "theme_setup_acceleration";
  private static final double THEME_SETUP_SCORE_MIN = 0.52;
  private static final double THEME_SETUP_SCORE_MAX = 0.65;
  private static final double THEME_SETUP_ACCEL_MIN_5D = 0.008;
  private static final double THEME_SETUP_RESOLVE_SCORE_LOW = 0.48;
  private static final double THEME_SETUP_RESOLVE_TREND_LOW = 0.003;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeSetupAccelerationAlertEvaluator(
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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_SETUP_ACCELERATION);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    if (constituentsByTheme.isEmpty() || composite.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
    List<Setup> setups =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), composite, trend5d))
            .flatMap(Optional::stream)
            .toList();

    setups.stream().filter(Setup::shouldFire).forEach(s -> fire(s, severity, signalDate));
    setups.stream().filter(Setup::shouldResolve).forEach(this::resolve);
    return (int) setups.stream().filter(Setup::shouldFire).count();
  }

  private Optional<Setup> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> trend5d) {
    if (constituentIds.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avgComposite = averageOf(constituentIds, composite);
    OptionalDouble avgTrend5d = averageOf(constituentIds, trend5d);
    if (avgComposite.isEmpty() || avgTrend5d.isEmpty()) {
      return Optional.empty();
    }
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_SETUP_ACCELERATION, themeId);
    return Optional.of(new Setup(themeId, avgComposite.getAsDouble(), avgTrend5d.getAsDouble(), active));
  }

  private OptionalDouble averageOf(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream()
        .map(values::get)
        .filter(value -> value != null)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  private void fire(Setup setup, Severity severity, LocalDate signalDate) {
    String themeId = setup.themeId();
    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            RULE_THEME_SETUP_ACCELERATION,
            severity,
            String.format(
                "%s pre-breakout: score %d in SETUP, 5d momentum +%.1fpt/day — %dpt from BUY entry",
                themeId, setup.scorePercent(), setup.trend5d() * 100, setup.pointsToBreakout()),
            String.format(
                "{\"themeId\":\"%s\",\"score\":%.4f,\"trend5d\":%.4f,\"ptsToBreakout\":%d,\"signalDate\":\"%s\"}",
                themeId, setup.score(), setup.trend5d(), setup.pointsToBreakout(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_setup_acceleration: theme={} score={} trend5d={}",
        themeId,
        setup.scorePercent(),
        String.format("%.3f", setup.trend5d()));
  }

  private void resolve(Setup setup) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_SETUP_ACCELERATION, setup.themeId());
    log.info(
        "theme_setup_acceleration: resolved theme={} (score={} trend5d={})",
        setup.themeId(),
        setup.scorePercent(),
        String.format("%.3f", setup.trend5d()));
  }

  /** A theme's pre-breakout setup reading for the day. */
  private record Setup(String themeId, double score, double trend5d, boolean hasActiveAlert) {

    int scorePercent() {
      return (int) Math.round(score * 100);
    }

    int pointsToBreakout() {
      return (int) Math.round((0.65 - score) * 100);
    }

    boolean shouldFire() {
      return score >= THEME_SETUP_SCORE_MIN
          && score < THEME_SETUP_SCORE_MAX
          && trend5d >= THEME_SETUP_ACCEL_MIN_5D
          && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return hasActiveAlert
          && (score >= THEME_SETUP_SCORE_MAX
              || score < THEME_SETUP_RESOLVE_SCORE_LOW
              || trend5d < THEME_SETUP_RESOLVE_TREND_LOW);
    }
  }
}

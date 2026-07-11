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
 * Fires per theme when its 5-day composite velocity pulls ahead of its 20-day velocity — an
 * acceleration that often marks a regime shift starting. Resolves when the 5d/20d gap normalises.
 */
@Component
public class Theme5dAccelerationAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(Theme5dAccelerationAlertEvaluator.class);

  private static final String RULE_THEME_5D_ACCELERATION = "theme_5d_acceleration";
  private static final double THEME_5D_ACCEL_DELTA_THRESHOLD = 0.008;
  private static final double THEME_5D_ACCEL_DELTA_RESOLVE = 0.003;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public Theme5dAccelerationAlertEvaluator(
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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_5D_ACCELERATION);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> trend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> trend20d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (constituentsByTheme.isEmpty() || trend5d.isEmpty() || trend20d.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
    List<Acceleration> accelerations =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), trend5d, trend20d))
            .flatMap(Optional::stream)
            .toList();

    accelerations.stream()
        .filter(Acceleration::shouldFire)
        .forEach(a -> fire(a, severity, signalDate));
    accelerations.stream().filter(Acceleration::shouldResolve).forEach(this::resolve);
    return (int) accelerations.stream().filter(Acceleration::shouldFire).count();
  }

  private Optional<Acceleration> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> trend5d,
      Map<String, BigDecimal> trend20d) {
    if (constituentIds.isEmpty()) {
      return Optional.empty();
    }
    OptionalDouble avg5d = averageOf(constituentIds, trend5d);
    OptionalDouble avg20d = averageOf(constituentIds, trend20d);
    if (avg5d.isEmpty() || avg20d.isEmpty()) {
      return Optional.empty();
    }
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_5D_ACCELERATION, themeId);
    return Optional.of(new Acceleration(themeId, avg5d.getAsDouble(), avg20d.getAsDouble(), active));
  }

  private OptionalDouble averageOf(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream()
        .map(values::get)
        .filter(value -> value != null)
        .mapToDouble(BigDecimal::doubleValue)
        .average();
  }

  private void fire(Acceleration acceleration, Severity severity, LocalDate signalDate) {
    String themeId = acceleration.themeId();
    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            RULE_THEME_5D_ACCELERATION,
            severity,
            String.format(
                "%s theme momentum accelerating: 5d trend +%dpt/day ahead of 20d — regime shift in progress",
                themeId, acceleration.deltaPoint()),
            String.format(
                "{\"themeId\":\"%s\",\"delta5d20d\":%.4f,\"avg5d\":%.4f,\"avg20d\":%.4f,\"signalDate\":\"%s\"}",
                themeId, acceleration.delta(), acceleration.avg5d(), acceleration.avg20d(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info("theme_5d_acceleration: theme={} delta={}pt/day", themeId, acceleration.deltaPoint());
  }

  private void resolve(Acceleration acceleration) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_5D_ACCELERATION, acceleration.themeId());
    log.info(
        "theme_5d_acceleration: resolved theme={} (acceleration normalised)", acceleration.themeId());
  }

  /** A theme's 5d-vs-20d velocity gap for the day. */
  private record Acceleration(String themeId, double avg5d, double avg20d, boolean hasActiveAlert) {
    double delta() {
      return avg5d - avg20d;
    }

    int deltaPoint() {
      return (int) Math.round(delta() * 100);
    }

    boolean shouldFire() {
      return delta() >= THEME_5D_ACCEL_DELTA_THRESHOLD && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return hasActiveAlert && delta() < THEME_5D_ACCEL_DELTA_RESOLVE;
    }
  }
}

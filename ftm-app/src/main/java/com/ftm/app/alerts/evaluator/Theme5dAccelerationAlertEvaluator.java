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
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_5D_ACCELERATION);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> trend5dMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> trend20dMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
    if (trend5dMap.isEmpty() || trend20dMap.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avg5d =
          ids.stream()
              .map(trend5dMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      OptionalDouble avg20d =
          ids.stream()
              .map(trend20dMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avg5d.isEmpty() || avg20d.isEmpty()) continue;

      double delta = avg5d.getAsDouble() - avg20d.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_5D_ACCELERATION, themeId);

      if (delta >= THEME_5D_ACCEL_DELTA_THRESHOLD && !hasActive) {
        Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
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
                    themeId, (int) Math.round(delta * 100)),
                String.format(
                    "{\"themeId\":\"%s\",\"delta5d20d\":%.4f,\"avg5d\":%.4f,\"avg20d\":%.4f,\"signalDate\":\"%s\"}",
                    themeId, delta, avg5d.getAsDouble(), avg20d.getAsDouble(), signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_5d_acceleration: theme={} delta={}pt/day",
            themeId,
            (int) Math.round(delta * 100));
      } else if (hasActive && delta < THEME_5D_ACCEL_DELTA_RESOLVE) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_5D_ACCELERATION, themeId);
        log.info("theme_5d_acceleration: resolved theme={} (acceleration normalised)", themeId);
      }
    }
    return count;
  }
}

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
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_SETUP_ACCELERATION);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> compositeMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trend5dMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    if (compositeMap.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();
      if (ids.isEmpty()) continue;

      OptionalDouble avgComposite =
          ids.stream()
              .map(compositeMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      OptionalDouble avgTrend5d =
          ids.stream()
              .map(trend5dMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();
      if (avgComposite.isEmpty() || avgTrend5d.isEmpty()) continue;

      double score = avgComposite.getAsDouble();
      double trend5d = avgTrend5d.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_SETUP_ACCELERATION, themeId);

      boolean inSetup = score >= THEME_SETUP_SCORE_MIN && score < THEME_SETUP_SCORE_MAX;
      boolean accelerating = trend5d >= THEME_SETUP_ACCEL_MIN_5D;

      if (inSetup && accelerating && !hasActive) {
        Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
        int scorePct = (int) Math.round(score * 100);
        int ptsToBreakout = (int) Math.round((0.65 - score) * 100);
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
                    themeId, scorePct, trend5d * 100, ptsToBreakout),
                String.format(
                    "{\"themeId\":\"%s\",\"score\":%.4f,\"trend5d\":%.4f,\"ptsToBreakout\":%d,\"signalDate\":\"%s\"}",
                    themeId, score, trend5d, ptsToBreakout, signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_setup_acceleration: theme={} score={} trend5d={}",
            themeId,
            scorePct,
            String.format("%.3f", trend5d));
      } else if (hasActive
          && (score >= THEME_SETUP_SCORE_MAX
              || score < THEME_SETUP_RESOLVE_SCORE_LOW
              || trend5d < THEME_SETUP_RESOLVE_TREND_LOW)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_SETUP_ACCELERATION, themeId);
        log.info(
            "theme_setup_acceleration: resolved theme={} (score={} trend5d={})",
            themeId,
            (int) Math.round(score * 100),
            String.format("%.3f", trend5d));
      }
    }
    return count;
  }
}

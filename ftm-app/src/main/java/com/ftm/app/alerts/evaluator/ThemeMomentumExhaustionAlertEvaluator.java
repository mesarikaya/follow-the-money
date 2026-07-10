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
    LocalDate signalDate = context.signalDate();

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_MOMENTUM_EXHAUSTION);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> compositeMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trend5dMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> trend20dMap =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_20D, signalDate);
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
      OptionalDouble avgTrend20d =
          ids.stream()
              .map(trend20dMap::get)
              .filter(v -> v != null)
              .mapToDouble(BigDecimal::doubleValue)
              .average();

      if (avgComposite.isEmpty() || avgTrend5d.isEmpty() || avgTrend20d.isEmpty()) continue;

      double score = avgComposite.getAsDouble();
      double trend5d = avgTrend5d.getAsDouble();
      double trend20d = avgTrend20d.getAsDouble();
      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_MOMENTUM_EXHAUSTION, themeId);

      boolean isExhausting =
          score >= THEME_EXHAUSTION_MIN_SCORE
              && trend5d < THEME_EXHAUSTION_MAX_5D
              && trend20d < THEME_EXHAUSTION_MAX_20D;

      if (isExhausting && !hasActive) {
        Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
        int scorePct = (int) Math.round(score * 100);
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
                    themeId, scorePct, trend5d * 100, trend20d * 100),
                String.format(
                    "{\"themeId\":\"%s\",\"score\":%.4f,\"trend5d\":%.4f,\"trend20d\":%.4f,\"signalDate\":\"%s\"}",
                    themeId, score, trend5d, trend20d, signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_momentum_exhaustion: theme={} score={} trend5d={} trend20d={}",
            themeId,
            scorePct,
            String.format("%.3f", trend5d),
            String.format("%.3f", trend20d));
      } else if (hasActive
          && (score < THEME_EXHAUSTION_RESOLVE_SCORE || trend5d > THEME_EXHAUSTION_RESOLVE_5D)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_MOMENTUM_EXHAUSTION, themeId);
        log.info(
            "theme_momentum_exhaustion: resolved theme={} (score={} trend5d={})",
            themeId,
            (int) Math.round(score * 100),
            String.format("%.3f", trend5d));
      }
    }
    return count;
  }
}

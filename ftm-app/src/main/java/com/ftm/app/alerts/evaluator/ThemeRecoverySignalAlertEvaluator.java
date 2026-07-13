package com.ftm.app.alerts.evaluator;

import static com.ftm.app.alerts.evaluator.ThemeSignalReader.PHASE_LOOKBACK_DAYS;
import static com.ftm.app.alerts.evaluator.ThemeSignalReader.average;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
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
 * Catches the turn before it shows: a beaten-down theme whose score has crept back into the 0.35–
 * 0.55 band on a rising 5-day trend, while its 20-day trend was still negative a trading week ago.
 * Resolves either way — when the recovery is confirmed (score above 0.60) or fails (below 0.30).
 */
@Component
public class ThemeRecoverySignalAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ThemeRecoverySignalAlertEvaluator.class);

  private static final String RULE_THEME_RECOVERY_SIGNAL = "theme_recovery_signal";

  private static final double RECOVERY_SCORE_MIN = 0.35;
  private static final double RECOVERY_SCORE_MAX = 0.55;
  private static final double RECOVERY_5D_MIN = 0.003;
  private static final double RECOVERY_PRIOR_20D_MAX = -0.001;
  private static final double RESOLVE_SCORE_HIGH = 0.60;
  private static final double RESOLVE_SCORE_LOW = 0.30;

  private final AlertRulesRepository alertRulesRepository;
  private final AlertRepository alertRepository;
  private final ThemeSignalReader themeSignalReader;

  public ThemeRecoverySignalAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      AlertRepository alertRepository,
      ThemeSignalReader themeSignalReader) {
    this.alertRulesRepository = alertRulesRepository;
    this.alertRepository = alertRepository;
    this.themeSignalReader = themeSignalReader;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_RECOVERY_SIGNAL);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeSignalReader.constituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composites =
        themeSignalReader.signalsAt(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> trends5d =
        themeSignalReader.signalsAt(SignalType.COMPOSITE_TREND_5D, signalDate);
    if (composites.isEmpty()) return 0;

    PriorTrends priorTrends = new PriorTrends(themeSignalReader, signalDate);

    int alertsCreated = 0;
    for (Map.Entry<String, List<String>> theme : constituentsByTheme.entrySet()) {
      String themeId = theme.getKey();
      List<String> categoryIds = theme.getValue();
      if (categoryIds.isEmpty()) continue;

      OptionalDouble averageScore = average(categoryIds, composites);
      OptionalDouble averageTrend5d = average(categoryIds, trends5d);
      if (averageScore.isEmpty() || averageTrend5d.isEmpty()) continue;

      double score = averageScore.getAsDouble();
      double trend5d = averageTrend5d.getAsDouble();
      boolean hasActiveAlert =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_RECOVERY_SIGNAL, themeId);

      if (isRecovering(score, trend5d) && !hasActiveAlert) {
        OptionalDouble priorTrend20d = priorTrends.trend20dFor(categoryIds);
        if (priorTrend20d.isPresent() && priorTrend20d.getAsDouble() < RECOVERY_PRIOR_20D_MAX) {
          raise(rule, themeId, signalDate, score, trend5d, priorTrend20d.getAsDouble());
          alertsCreated++;
        }
      } else if (hasActiveAlert && (score > RESOLVE_SCORE_HIGH || score < RESOLVE_SCORE_LOW)) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_RECOVERY_SIGNAL, themeId);
        log.info(
            "theme_recovery_signal: resolved theme={} (score={})",
            themeId,
            (int) Math.round(score * 100));
      }
    }
    return alertsCreated;
  }

  /** Back in the recovery band, and turning up on the short horizon. */
  private static boolean isRecovering(double score, double trend5d) {
    return score >= RECOVERY_SCORE_MIN && score <= RECOVERY_SCORE_MAX && trend5d > RECOVERY_5D_MIN;
  }

  private void raise(
      Optional<AlertRule> rule,
      String themeId,
      LocalDate signalDate,
      double score,
      double trend5d,
      double priorTrend20d) {

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);
    int scorePercent = (int) Math.round(score * 100);

    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            RULE_THEME_RECOVERY_SIGNAL,
            severity,
            String.format(
                "%s showing recovery: score %d, 5d trend +%.1fpt/day (20d was negative 5 days ago) — early turn signal, watch for follow-through",
                themeId, scorePercent, trend5d * 100),
            String.format(
                "{\"themeId\":\"%s\",\"score\":%.4f,\"trend5d\":%.4f,\"priorTrend20d\":%.4f,\"signalDate\":\"%s\"}",
                themeId, score, trend5d, priorTrend20d, signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_recovery_signal: theme={} score={} trend5d={} priorTrend20d={}",
        themeId,
        scorePercent,
        String.format("%.3f", trend5d),
        String.format("%.3f", priorTrend20d));
  }

  /**
   * Only the 20-day trend from a week ago is needed here, so this loads that one map — and only once
   * a theme is actually found in the recovery band.
   */
  private static final class PriorTrends {

    private final ThemeSignalReader reader;
    private final LocalDate signalDate;

    private boolean loaded;
    private Map<String, BigDecimal> trends20d = Map.of();

    PriorTrends(ThemeSignalReader reader, LocalDate signalDate) {
      this.reader = reader;
      this.signalDate = signalDate;
    }

    OptionalDouble trend20dFor(List<String> categoryIds) {
      if (!loaded) {
        loaded = true;
        LocalDate priorDate =
            reader.nthPreviousSignalDate(SignalType.COMPOSITE, signalDate, PHASE_LOOKBACK_DAYS);
        if (priorDate != null) {
          trends20d = reader.signalsAt(SignalType.COMPOSITE_TREND_20D, priorDate);
        }
      }
      return average(categoryIds, trends20d);
    }
  }
}

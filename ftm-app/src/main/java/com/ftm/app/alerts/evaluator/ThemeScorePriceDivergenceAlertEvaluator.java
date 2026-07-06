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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires when a theme's model score is bullish but its price-based relative strength (RS20) is
 * negative — the thesis and the tape disagree, warning of a possible mean-reversion or thesis
 * breakdown. Resolves when the score cools or RS20 turns non-negative.
 */
@Component
public class ThemeScorePriceDivergenceAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeScorePriceDivergenceAlertEvaluator.class);

  private static final String RULE_THEME_SCORE_PRICE_DIVERGENCE = "theme_score_price_divergence";
  private static final double THEME_SPD_FIRE_SCORE_MIN = 0.62;
  private static final double THEME_SPD_FIRE_RS20_MAX = -0.005;
  private static final double THEME_SPD_RESOLVE_SCORE_MAX = 0.55;
  private static final int THEME_SPD_MIN_CONSTITUENTS = 2;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeScorePriceDivergenceAlertEvaluator(
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

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_SCORE_PRICE_DIVERGENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> currentComposite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> currentRs20 =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    if (currentComposite.isEmpty() || currentRs20.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();

      List<String> constituentsWithBothSignals =
          ids.stream()
              .filter(id -> currentComposite.containsKey(id) && currentRs20.containsKey(id))
              .toList();

      if (constituentsWithBothSignals.size() < THEME_SPD_MIN_CONSTITUENTS) continue;

      double avgComposite =
          constituentsWithBothSignals.stream()
              .mapToDouble(id -> currentComposite.get(id).doubleValue())
              .average()
              .getAsDouble();

      double avgRs20 =
          constituentsWithBothSignals.stream()
              .mapToDouble(id -> currentRs20.get(id).doubleValue())
              .average()
              .getAsDouble();

      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_SCORE_PRICE_DIVERGENCE, themeId);

      boolean divergenceActive =
          avgComposite >= THEME_SPD_FIRE_SCORE_MIN && avgRs20 < THEME_SPD_FIRE_RS20_MAX;
      boolean divergenceResolved = avgComposite < THEME_SPD_RESOLVE_SCORE_MAX || avgRs20 >= 0.0;

      if (!hasActive && divergenceActive) {
        Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
        int scorePct = (int) Math.round(avgComposite * 100);
        alertRepository.insert(
            new Alert(
                null,
                OffsetDateTime.now(),
                null,
                themeId,
                RULE_THEME_SCORE_PRICE_DIVERGENCE,
                severity,
                String.format(
                    "%s score-price divergence: model score %d (bullish) conflicts with negative"
                        + " RS20 (%.3f) — price momentum not confirming thesis; monitor for"
                        + " potential mean-reversion or thesis breakdown",
                    themeId, scorePct, avgRs20),
                String.format(
                    "{\"themeId\":\"%s\",\"avgComposite\":%.4f,\"avgRs20\":%.4f,"
                        + "\"constituents\":%d,\"signalDate\":\"%s\"}",
                    themeId, avgComposite, avgRs20, constituentsWithBothSignals.size(), signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_score_price_divergence: fired theme={} avgComposite={} avgRs20={}",
            themeId,
            scorePct,
            String.format("%.3f", avgRs20));
      } else if (hasActive && divergenceResolved) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_SCORE_PRICE_DIVERGENCE, themeId);
        log.info(
            "theme_score_price_divergence: resolved theme={} (avgComposite={} avgRs20={})",
            themeId,
            (int) Math.round(avgComposite * 100),
            String.format("%.3f", avgRs20));
      }
    }
    return count;
  }
}

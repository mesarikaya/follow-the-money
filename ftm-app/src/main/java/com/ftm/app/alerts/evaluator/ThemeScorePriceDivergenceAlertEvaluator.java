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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_SCORE_PRICE_DIVERGENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> rs20 = signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    if (constituentsByTheme.isEmpty() || composite.isEmpty() || rs20.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<ThemeAverages> averages =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), composite, rs20))
            .flatMap(Optional::stream)
            .toList();

    averages.stream().filter(ThemeAverages::shouldFire).forEach(a -> fire(a, severity, signalDate));
    averages.stream().filter(ThemeAverages::shouldResolve).forEach(this::resolve);
    return (int) averages.stream().filter(ThemeAverages::shouldFire).count();
  }

  private Optional<ThemeAverages> assess(
      String themeId,
      List<String> constituentIds,
      Map<String, BigDecimal> composite,
      Map<String, BigDecimal> rs20) {
    List<String> withBoth =
        constituentIds.stream()
            .filter(id -> composite.containsKey(id) && rs20.containsKey(id))
            .toList();
    if (withBoth.size() < THEME_SPD_MIN_CONSTITUENTS) {
      return Optional.empty();
    }
    double avgComposite = average(withBoth, composite);
    double avgRs20 = average(withBoth, rs20);
    boolean active =
        alertRepository.existsActiveAlertForTheme(RULE_THEME_SCORE_PRICE_DIVERGENCE, themeId);
    return Optional.of(new ThemeAverages(themeId, withBoth.size(), avgComposite, avgRs20, active));
  }

  private double average(List<String> ids, Map<String, BigDecimal> values) {
    return ids.stream().mapToDouble(id -> values.get(id).doubleValue()).average().getAsDouble();
  }

  private void fire(ThemeAverages averages, Severity severity, LocalDate signalDate) {
    String themeId = averages.themeId();
    int scorePct = averages.scorePercent();
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
                themeId, scorePct, averages.avgRs20()),
            String.format(
                "{\"themeId\":\"%s\",\"avgComposite\":%.4f,\"avgRs20\":%.4f,"
                    + "\"constituents\":%d,\"signalDate\":\"%s\"}",
                themeId, averages.avgComposite(), averages.avgRs20(), averages.constituentCount(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_score_price_divergence: fired theme={} avgComposite={} avgRs20={}",
        themeId,
        scorePct,
        String.format("%.3f", averages.avgRs20()));
  }

  private void resolve(ThemeAverages averages) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_SCORE_PRICE_DIVERGENCE, averages.themeId());
    log.info(
        "theme_score_price_divergence: resolved theme={} (avgComposite={} avgRs20={})",
        averages.themeId(),
        averages.scorePercent(),
        String.format("%.3f", averages.avgRs20()));
  }

  /** A theme's average model score and price RS-20 for the day. */
  private record ThemeAverages(
      String themeId, int constituentCount, double avgComposite, double avgRs20, boolean hasActiveAlert) {

    int scorePercent() {
      return (int) Math.round(avgComposite * 100);
    }

    boolean shouldFire() {
      return !hasActiveAlert
          && avgComposite >= THEME_SPD_FIRE_SCORE_MIN
          && avgRs20 < THEME_SPD_FIRE_RS20_MAX;
    }

    boolean shouldResolve() {
      return hasActiveAlert && (avgComposite < THEME_SPD_RESOLVE_SCORE_MAX || avgRs20 >= 0.0);
    }
  }
}

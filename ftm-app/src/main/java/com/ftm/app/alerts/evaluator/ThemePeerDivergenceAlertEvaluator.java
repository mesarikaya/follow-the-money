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
 * Fires when a theme's constituents diverge internally — a wide max−min composite spread while the
 * theme average is still healthy — signalling within-theme rotation (a leader pulling ahead of a
 * laggard, i.e. a possible catch-up opportunity). Resolves when the spread narrows.
 */
@Component
public class ThemePeerDivergenceAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ThemePeerDivergenceAlertEvaluator.class);

  private static final String RULE_THEME_PEER_DIVERGENCE = "theme_peer_divergence";
  private static final double THEME_PEER_DIVERGENCE_SPREAD_FIRE = 0.30;
  private static final double THEME_PEER_DIVERGENCE_SPREAD_RESOLVE = 0.20;
  private static final double THEME_PEER_DIVERGENCE_AVG_SCORE_MIN = 0.40;
  private static final int THEME_PEER_DIVERGENCE_MIN_CONSTITUENTS = 3;

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemePeerDivergenceAlertEvaluator(
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

    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_PEER_DIVERGENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    if (constituentsByTheme.isEmpty()) return 0;

    Map<String, BigDecimal> currentComposite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (currentComposite.isEmpty()) return 0;

    int count = 0;
    for (Map.Entry<String, List<String>> entry : constituentsByTheme.entrySet()) {
      String themeId = entry.getKey();
      List<String> ids = entry.getValue();

      List<Map.Entry<String, Double>> scoredConstituents =
          ids.stream()
              .filter(id -> currentComposite.containsKey(id))
              .map(id -> Map.entry(id, currentComposite.get(id).doubleValue()))
              .toList();

      if (scoredConstituents.size() < THEME_PEER_DIVERGENCE_MIN_CONSTITUENTS) continue;

      double maxScore =
          scoredConstituents.stream().mapToDouble(Map.Entry::getValue).max().getAsDouble();
      double minScore =
          scoredConstituents.stream().mapToDouble(Map.Entry::getValue).min().getAsDouble();
      double avgScore =
          scoredConstituents.stream().mapToDouble(Map.Entry::getValue).average().getAsDouble();
      double spread = maxScore - minScore;

      String leaderId =
          scoredConstituents.stream()
              .filter(e -> e.getValue() == maxScore)
              .findFirst()
              .map(Map.Entry::getKey)
              .orElse("?");
      String laggardId =
          scoredConstituents.stream()
              .filter(e -> e.getValue() == minScore)
              .findFirst()
              .map(Map.Entry::getKey)
              .orElse("?");

      boolean hasActive =
          alertRepository.existsActiveAlertForTheme(RULE_THEME_PEER_DIVERGENCE, themeId);

      if (!hasActive
          && spread > THEME_PEER_DIVERGENCE_SPREAD_FIRE
          && avgScore > THEME_PEER_DIVERGENCE_AVG_SCORE_MIN) {
        Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);
        int spreadPct = (int) Math.round(spread * 100);
        int leaderPct = (int) Math.round(maxScore * 100);
        int laggardPct = (int) Math.round(minScore * 100);
        alertRepository.insert(
            new Alert(
                null,
                OffsetDateTime.now(),
                null,
                themeId,
                RULE_THEME_PEER_DIVERGENCE,
                severity,
                String.format(
                    "%s internal rotation: %s leads (score %d) while %s lags (score %d) — spread"
                        + " of %d pts suggests within-theme catch-up opportunity",
                    themeId, leaderId, leaderPct, laggardId, laggardPct, spreadPct),
                String.format(
                    "{\"themeId\":\"%s\",\"leaderId\":\"%s\",\"laggardId\":\"%s\","
                        + "\"spread\":%.4f,\"avgScore\":%.4f,\"signalDate\":\"%s\"}",
                    themeId, leaderId, laggardId, spread, avgScore, signalDate),
                AlertStatus.ACTIVE,
                null,
                null));
        count++;
        log.info(
            "theme_peer_divergence: fired theme={} leader={} laggard={} spread={}",
            themeId,
            leaderId,
            laggardId,
            spreadPct);
      } else if (hasActive && spread < THEME_PEER_DIVERGENCE_SPREAD_RESOLVE) {
        alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_PEER_DIVERGENCE, themeId);
        log.info(
            "theme_peer_divergence: resolved theme={} (spread={})",
            themeId,
            (int) Math.round(spread * 100));
      }
    }
    return count;
  }
}

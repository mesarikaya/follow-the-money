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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_PEER_DIVERGENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, List<String>> constituentsByTheme = themeRepository.findAllConstituentsByTheme();
    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (constituentsByTheme.isEmpty() || composite.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);
    List<PeerSpread> spreads =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), composite))
            .flatMap(Optional::stream)
            .toList();

    spreads.stream().filter(PeerSpread::shouldFire).forEach(s -> fire(s, severity, signalDate));
    spreads.stream().filter(PeerSpread::shouldResolve).forEach(this::resolve);
    return (int) spreads.stream().filter(PeerSpread::shouldFire).count();
  }

  private Optional<PeerSpread> assess(
      String themeId, List<String> constituentIds, Map<String, BigDecimal> composite) {
    List<Map.Entry<String, Double>> scored =
        constituentIds.stream()
            .filter(composite::containsKey)
            .map(id -> Map.entry(id, composite.get(id).doubleValue()))
            .toList();
    if (scored.size() < THEME_PEER_DIVERGENCE_MIN_CONSTITUENTS) {
      return Optional.empty();
    }
    double maxScore = scored.stream().mapToDouble(Map.Entry::getValue).max().getAsDouble();
    double minScore = scored.stream().mapToDouble(Map.Entry::getValue).min().getAsDouble();
    double avgScore = scored.stream().mapToDouble(Map.Entry::getValue).average().getAsDouble();
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_PEER_DIVERGENCE, themeId);
    return Optional.of(
        new PeerSpread(
            themeId,
            leaderWithScore(scored, maxScore),
            leaderWithScore(scored, minScore),
            maxScore,
            minScore,
            avgScore,
            active));
  }

  private String leaderWithScore(List<Map.Entry<String, Double>> scored, double target) {
    return scored.stream()
        .filter(entry -> entry.getValue() == target)
        .findFirst()
        .map(Map.Entry::getKey)
        .orElse("?");
  }

  private void fire(PeerSpread spread, Severity severity, LocalDate signalDate) {
    String themeId = spread.themeId();
    int spreadPct = spread.spreadPercent();
    int leaderPct = (int) Math.round(spread.maxScore() * 100);
    int laggardPct = (int) Math.round(spread.minScore() * 100);
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
                themeId, spread.leaderId(), leaderPct, spread.laggardId(), laggardPct, spreadPct),
            String.format(
                "{\"themeId\":\"%s\",\"leaderId\":\"%s\",\"laggardId\":\"%s\","
                    + "\"spread\":%.4f,\"avgScore\":%.4f,\"signalDate\":\"%s\"}",
                themeId, spread.leaderId(), spread.laggardId(), spread.spread(), spread.avgScore(), signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_peer_divergence: fired theme={} leader={} laggard={} spread={}",
        themeId,
        spread.leaderId(),
        spread.laggardId(),
        spreadPct);
  }

  private void resolve(PeerSpread spread) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_PEER_DIVERGENCE, spread.themeId());
    log.info(
        "theme_peer_divergence: resolved theme={} (spread={})",
        spread.themeId(),
        spread.spreadPercent());
  }

  /** A theme's internal composite spread for the day. */
  private record PeerSpread(
      String themeId,
      String leaderId,
      String laggardId,
      double maxScore,
      double minScore,
      double avgScore,
      boolean hasActiveAlert) {

    double spread() {
      return maxScore - minScore;
    }

    int spreadPercent() {
      return (int) Math.round(spread() * 100);
    }

    boolean shouldFire() {
      return !hasActiveAlert
          && spread() > THEME_PEER_DIVERGENCE_SPREAD_FIRE
          && avgScore > THEME_PEER_DIVERGENCE_AVG_SCORE_MIN;
    }

    boolean shouldResolve() {
      return hasActiveAlert && spread() < THEME_PEER_DIVERGENCE_SPREAD_RESOLVE;
    }
  }
}

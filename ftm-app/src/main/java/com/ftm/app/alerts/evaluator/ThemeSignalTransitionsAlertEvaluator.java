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
 * Fires per theme when a majority of its constituents cross into BUY (or into REDUCE) territory —
 * the theme itself has flipped its dominant signal, i.e. cross-sector rotation is confirmed.
 * Resolves when neither side is a majority any more.
 */
@Component
public class ThemeSignalTransitionsAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ThemeSignalTransitionsAlertEvaluator.class);

  private static final String RULE_THEME_SIGNAL_TRANSITION = "theme_dominant_signal_transition";
  private static final double THEME_BUY_FIRE_FRACTION = 0.50;
  private static final double THEME_REDUCE_FIRE_FRACTION = 0.50;
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal REDUCE_SCORE_THRESHOLD = new BigDecimal("0.35");

  private final AlertRulesRepository alertRulesRepository;
  private final ThemeRepository themeRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ThemeSignalTransitionsAlertEvaluator(
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
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_THEME_SIGNAL_TRANSITION);
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

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.ACTION);
    List<ThemeVote> votes =
        constituentsByTheme.entrySet().stream()
            .map(entry -> assess(entry.getKey(), entry.getValue(), composite))
            .flatMap(Optional::stream)
            .toList();

    votes.stream().filter(ThemeVote::shouldFire).forEach(v -> fire(v, severity, signalDate));
    votes.stream().filter(ThemeVote::shouldResolve).forEach(this::resolve);
    return (int) votes.stream().filter(ThemeVote::shouldFire).count();
  }

  private Optional<ThemeVote> assess(
      String themeId, List<String> constituentIds, Map<String, BigDecimal> composite) {
    if (constituentIds.isEmpty()) {
      return Optional.empty();
    }
    long buyCount = countAtLeast(constituentIds, composite, BUY_SCORE_THRESHOLD);
    long reduceCount = countBelow(constituentIds, composite, REDUCE_SCORE_THRESHOLD);
    boolean active = alertRepository.existsActiveAlertForTheme(RULE_THEME_SIGNAL_TRANSITION, themeId);
    return Optional.of(
        new ThemeVote(themeId, (int) buyCount, (int) reduceCount, constituentIds.size(), active));
  }

  private long countAtLeast(List<String> ids, Map<String, BigDecimal> composite, BigDecimal min) {
    return ids.stream()
        .map(composite::get)
        .filter(score -> score != null && score.compareTo(min) >= 0)
        .count();
  }

  private long countBelow(List<String> ids, Map<String, BigDecimal> composite, BigDecimal max) {
    return ids.stream()
        .map(composite::get)
        .filter(score -> score != null && score.compareTo(max) < 0)
        .count();
  }

  private void fire(ThemeVote vote, Severity severity, LocalDate signalDate) {
    Direction direction = vote.direction().orElseThrow();
    String themeId = vote.themeId();
    alertRepository.insert(
        new Alert(
            null,
            OffsetDateTime.now(),
            null,
            themeId,
            RULE_THEME_SIGNAL_TRANSITION,
            severity,
            direction.message(themeId, direction.count(vote), vote.total()),
            direction.snapshot(themeId, vote, signalDate),
            AlertStatus.ACTIVE,
            null,
            null));
    log.info(
        "theme_signal_transition {}: theme={} fraction={}% ({}/{})",
        direction.name(),
        themeId,
        Math.round(direction.fraction(vote) * 100),
        direction.count(vote),
        vote.total());
  }

  private void resolve(ThemeVote vote) {
    alertRepository.resolveAlertsByRuleAndTheme(RULE_THEME_SIGNAL_TRANSITION, vote.themeId());
    log.info("theme_signal_transition: resolved theme={} (signal neutralised)", vote.themeId());
  }

  /** A theme's dominant-signal tally for the day. */
  private record ThemeVote(String themeId, int buyCount, int reduceCount, int total, boolean hasActiveAlert) {

    boolean buyMajority() {
      return (double) buyCount / total >= THEME_BUY_FIRE_FRACTION;
    }

    boolean reduceMajority() {
      return (double) reduceCount / total >= THEME_REDUCE_FIRE_FRACTION;
    }

    /** The single dominant direction, or empty when neither (or both) side holds a majority. */
    Optional<Direction> direction() {
      if (buyMajority() && !reduceMajority()) {
        return Optional.of(Direction.BUY);
      }
      if (reduceMajority() && !buyMajority()) {
        return Optional.of(Direction.REDUCE);
      }
      return Optional.empty();
    }

    boolean shouldFire() {
      return direction().isPresent() && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return hasActiveAlert && direction().isEmpty();
    }
  }

  private enum Direction {
    BUY(
        "%s theme entered BUY: %d/%d constituents above BUY threshold — cross-sector rotation confirmed",
        "buyFraction",
        "buyCount"),
    REDUCE(
        "%s theme entered REDUCE: %d/%d constituents below REDUCE threshold — theme rotation reversing",
        "reduceFraction",
        "reduceCount");

    private final String messageTemplate;
    private final String fractionKey;
    private final String countKey;

    Direction(String messageTemplate, String fractionKey, String countKey) {
      this.messageTemplate = messageTemplate;
      this.fractionKey = fractionKey;
      this.countKey = countKey;
    }

    int count(ThemeVote vote) {
      return this == BUY ? vote.buyCount() : vote.reduceCount();
    }

    double fraction(ThemeVote vote) {
      return (double) count(vote) / vote.total();
    }

    String message(String themeId, int count, int total) {
      return String.format(messageTemplate, themeId, count, total);
    }

    String snapshot(String themeId, ThemeVote vote, LocalDate signalDate) {
      return String.format(
          "{\"themeId\":\"%s\",\"%s\":%.2f,\"%s\":%d,\"total\":%d,\"signalDate\":\"%s\"}",
          themeId, fractionKey, fraction(vote), countKey, count(vote), vote.total(), signalDate);
    }
  }
}

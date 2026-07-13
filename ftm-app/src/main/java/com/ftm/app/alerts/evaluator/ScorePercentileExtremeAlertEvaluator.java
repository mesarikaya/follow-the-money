package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import com.ftm.app.signals.repository.SignalAnalyticsRepository;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires per equity sector when its composite score sits at a 252-day extreme — very high (&ge; 90th
 * percentile, mean-reversion risk) or very low (&le; 10th percentile, turnaround watch). Resolves
 * once the percentile returns inside the normal band.
 */
@Component
public class ScorePercentileExtremeAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(ScorePercentileExtremeAlertEvaluator.class);

  private static final String RULE_SCORE_PERCENTILE_EXTREME = "score_percentile_extreme";
  private static final double SCORE_PERCENTILE_HIGH_FIRE = 0.90;
  private static final double SCORE_PERCENTILE_LOW_FIRE = 0.10;
  private static final double SCORE_PERCENTILE_HIGH_RESOLVE = 0.80;
  private static final double SCORE_PERCENTILE_LOW_RESOLVE = 0.20;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final SignalAnalyticsRepository signalAnalyticsRepository;
  private final AlertRepository alertRepository;

  public ScorePercentileExtremeAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      SignalAnalyticsRepository signalAnalyticsRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.signalAnalyticsRepository = signalAnalyticsRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SCORE_PERCENTILE_EXTREME);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Map<String, BigDecimal> percentiles = signalAnalyticsRepository.findScorePercentile252d();
    if (percentiles.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);
    List<Assessment> assessed =
        context.equityCategoryIds().stream()
            .map(categoryId -> assess(categoryId, percentiles))
            .flatMap(Optional::stream)
            .toList();

    assessed.stream().filter(Assessment::shouldFire).forEach(a -> fire(a, severity));
    assessed.stream().filter(Assessment::shouldResolve).forEach(this::resolve);
    return (int) assessed.stream().filter(Assessment::shouldFire).count();
  }

  private Optional<Assessment> assess(String categoryId, Map<String, BigDecimal> percentiles) {
    BigDecimal pct = percentiles.get(categoryId);
    if (pct == null) {
      return Optional.empty();
    }
    double percentile = pct.doubleValue();
    boolean active = alertRepository.existsActiveAlert(RULE_SCORE_PERCENTILE_EXTREME, categoryId);
    return Optional.of(
        new Assessment(
            categoryId,
            knownCategory(categoryId),
            percentile,
            extreme(percentile),
            isNormal(percentile),
            active));
  }

  private Optional<Extreme> extreme(double percentile) {
    return percentile >= SCORE_PERCENTILE_HIGH_FIRE
        ? Optional.of(Extreme.HIGH)
        : percentile <= SCORE_PERCENTILE_LOW_FIRE ? Optional.of(Extreme.LOW) : Optional.empty();
  }

  private boolean isNormal(double percentile) {
    return percentile < SCORE_PERCENTILE_HIGH_RESOLVE && percentile > SCORE_PERCENTILE_LOW_RESOLVE;
  }

  private void fire(Assessment assessment, Severity severity) {
    Extreme extreme = assessment.extreme().orElseThrow();
    double percentile = assessment.percentile();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            assessment.category().orElseThrow(),
            RULE_SCORE_PERCENTILE_EXTREME,
            severity,
            extreme.message(assessment.categoryId(), percentile),
            String.format("{\"percentile252d\":%.4f,\"direction\":\"%s\"}", percentile, extreme.name()),
            AlertStatus.ACTIVE));
    log.info(
        "score_percentile_extreme: category={} direction={} percentile={}",
        assessment.categoryId(),
        extreme.name(),
        percentile);
  }

  private void resolve(Assessment assessment) {
    alertRepository.resolveAlertsByRuleAndCategory(
        RULE_SCORE_PERCENTILE_EXTREME, assessment.categoryId());
    log.info(
        "score_percentile_extreme: resolved for category={} (percentile={} returned to normal)",
        assessment.categoryId(),
        assessment.percentile());
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("score_percentile_extreme: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  /** One sector's 252-day percentile verdict for the day. */
  private record Assessment(
      String categoryId,
      Optional<CategoryId> category,
      double percentile,
      Optional<Extreme> extreme,
      boolean normal,
      boolean hasActiveAlert) {

    boolean shouldFire() {
      return extreme.isPresent() && category.isPresent() && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return normal && hasActiveAlert;
    }
  }

  private enum Extreme {
    HIGH(
        "%s composite at 252d HIGH (%.0fth pct) — historically stretched, mean-reversion risk"),
    LOW("%s composite at 252d LOW (%.0fth pct) — historically depressed, turnaround watch");

    private final String messageTemplate;

    Extreme(String messageTemplate) {
      this.messageTemplate = messageTemplate;
    }

    String message(String categoryId, double percentile) {
      return String.format(messageTemplate, categoryId, percentile * 100);
    }
  }
}

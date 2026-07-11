package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
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
 * Fires per sector when its composite score moves ≥12 pts in five trading days — a SURGE (rapid
 * momentum acceleration) or a CRASH (rapid deterioration, an early warning before the formal REDUCE
 * signal). Resolves when the 5-day trend moderates back inside the ±5 pt normal range.
 */
@Component
public class ScoreVelocityAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(ScoreVelocityAlertEvaluator.class);

  private static final String RULE_SCORE_VELOCITY = "score_velocity";
  private static final BigDecimal SCORE_VELOCITY_SURGE_THRESHOLD = new BigDecimal("0.12");
  private static final BigDecimal SCORE_VELOCITY_CRASH_THRESHOLD = new BigDecimal("-0.12");
  private static final BigDecimal SCORE_VELOCITY_SURGE_RESOLVE = new BigDecimal("0.05");
  private static final BigDecimal SCORE_VELOCITY_CRASH_RESOLVE = new BigDecimal("-0.05");

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public ScoreVelocityAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SCORE_VELOCITY);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> trend5d =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE_TREND_5D, signalDate);
    Map<String, BigDecimal> composites =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    if (trend5d.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<Assessment> assessed =
        context.topLevelCategoryIds().stream()
            .map(categoryId -> assess(categoryId, trend5d, composites))
            .flatMap(Optional::stream)
            .toList();

    assessed.stream().filter(Assessment::shouldFire).forEach(a -> fire(a, severity, signalDate));
    assessed.stream().filter(Assessment::shouldResolve).forEach(this::resolve);
    return (int) assessed.stream().filter(Assessment::shouldFire).count();
  }

  private Optional<Assessment> assess(
      String categoryId, Map<String, BigDecimal> trend5d, Map<String, BigDecimal> composites) {
    BigDecimal trend = trend5d.get(categoryId);
    if (trend == null) {
      return Optional.empty();
    }
    boolean active = alertRepository.existsActiveAlert(RULE_SCORE_VELOCITY, categoryId);
    return Optional.of(
        new Assessment(
            categoryId,
            knownCategory(categoryId),
            trend,
            composites.get(categoryId),
            direction(trend),
            isNormal(trend),
            active));
  }

  private Optional<Direction> direction(BigDecimal trend) {
    return trend.compareTo(SCORE_VELOCITY_SURGE_THRESHOLD) >= 0
        ? Optional.of(Direction.SURGE)
        : trend.compareTo(SCORE_VELOCITY_CRASH_THRESHOLD) <= 0
            ? Optional.of(Direction.CRASH)
            : Optional.empty();
  }

  private boolean isNormal(BigDecimal trend) {
    return trend.compareTo(SCORE_VELOCITY_SURGE_RESOLVE) < 0
        && trend.compareTo(SCORE_VELOCITY_CRASH_RESOLVE) > 0;
  }

  private void fire(Assessment assessment, Severity severity, LocalDate signalDate) {
    Direction direction = assessment.direction().orElseThrow();
    BigDecimal trend = assessment.trend();
    BigDecimal composite = assessment.composite();
    int scorePts = composite != null ? Math.round(composite.floatValue() * 100) : -1;
    int trendPts = Math.abs(Math.round(trend.floatValue() * 100));
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            assessment.category().orElseThrow(),
            RULE_SCORE_VELOCITY,
            severity,
            direction.message(assessment.categoryId(), trendPts, scorePts),
            String.format(
                "{\"trend5d\":%.4f,\"composite\":%.4f,\"direction\":\"%s\",\"signalDate\":\"%s\"}",
                trend.doubleValue(),
                composite != null ? composite.doubleValue() : 0.0,
                direction.name(),
                signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "score_velocity: category={} direction={} trend5d={} composite={}",
        assessment.categoryId(),
        direction.name(),
        trend,
        composite);
  }

  private void resolve(Assessment assessment) {
    alertRepository.resolveAlertsByRuleAndCategory(RULE_SCORE_VELOCITY, assessment.categoryId());
    log.info(
        "score_velocity: resolved for category={} (trend5d={} returned to normal)",
        assessment.categoryId(),
        assessment.trend());
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("score_velocity: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  /** One sector's velocity verdict for the day. */
  private record Assessment(
      String categoryId,
      Optional<CategoryId> category,
      BigDecimal trend,
      BigDecimal composite,
      Optional<Direction> direction,
      boolean normal,
      boolean hasActiveAlert) {

    boolean shouldFire() {
      return direction.isPresent() && category.isPresent() && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return normal && hasActiveAlert;
    }
  }

  private enum Direction {
    SURGE("%s score velocity SURGE: +%dpts in 5 days (now %d) — rapid momentum acceleration"),
    CRASH("%s score velocity CRASH: -%dpts in 5 days (now %d) — rapid momentum deterioration");

    private final String messageTemplate;

    Direction(String messageTemplate) {
      this.messageTemplate = messageTemplate;
    }

    String message(String categoryId, int trendPts, int scorePts) {
      return String.format(messageTemplate, categoryId, trendPts, scorePts);
    }
  }
}

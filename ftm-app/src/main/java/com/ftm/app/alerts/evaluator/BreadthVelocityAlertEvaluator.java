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
 * Fires per equity sector whose breadth is accelerating or decelerating: it compares the last-5-day
 * benchmark hit-rate against the prior-15-day baseline. When the recent rate jumps at least {@value
 * #BREADTH_VELOCITY_THRESHOLD_PP}pp above baseline it fires ACCEL; when it drops that far below it
 * fires DECEL. Resolution is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class BreadthVelocityAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(BreadthVelocityAlertEvaluator.class);

  private static final int BREADTH_VELOCITY_THRESHOLD_PP = 10;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public BreadthVelocityAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> accelRule = alertRulesRepository.findById(Direction.ACCEL.ruleId);
    Optional<AlertRule> decelRule = alertRulesRepository.findById(Direction.DECEL.ruleId);
    boolean accelEnabled = accelRule.map(AlertRule::enabled).orElse(false);
    boolean decelEnabled = decelRule.map(AlertRule::enabled).orElse(false);
    if (!accelEnabled && !decelEnabled) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> persistence20d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_20D, signalDate);
    Map<String, BigDecimal> persistence5d =
        signalRepository.findByTypeAndDate(SignalType.PERSISTENCE_5D, signalDate);
    if (persistence20d.isEmpty() || persistence5d.isEmpty()) {
      return 0;
    }

    Map<Direction, Severity> severities =
        Map.of(
            Direction.ACCEL, accelRule.map(AlertRule::severity).orElse(Severity.INFO),
            Direction.DECEL, decelRule.map(AlertRule::severity).orElse(Severity.WARNING));

    List<Breach> breaches =
        context.equityCategoryIds().stream()
            .map(categoryId -> assess(categoryId, persistence5d, persistence20d, accelEnabled, decelEnabled))
            .flatMap(Optional::stream)
            .filter(this::notAlreadyAlerted)
            .toList();

    breaches.forEach(breach -> fire(breach, severities.get(breach.direction()), signalDate));
    return breaches.size();
  }

  private Optional<Breach> assess(
      String categoryId,
      Map<String, BigDecimal> persistence5d,
      Map<String, BigDecimal> persistence20d,
      boolean accelEnabled,
      boolean decelEnabled) {
    BigDecimal p5 = persistence5d.get(categoryId);
    BigDecimal p20 = persistence20d.get(categoryId);
    if (p5 == null || p20 == null) {
      return Optional.empty();
    }
    int velocityPp = velocityPercentagePoints(p5, p20);
    return direction(velocityPp, accelEnabled, decelEnabled)
        .flatMap(
            direction ->
                knownCategory(categoryId)
                    .map(category -> new Breach(categoryId, category, direction, velocityPp, p5, p20)));
  }

  private Optional<Direction> direction(int velocityPp, boolean accelEnabled, boolean decelEnabled) {
    return accelEnabled && velocityPp >= BREADTH_VELOCITY_THRESHOLD_PP
        ? Optional.of(Direction.ACCEL)
        : decelEnabled && velocityPp <= -BREADTH_VELOCITY_THRESHOLD_PP
            ? Optional.of(Direction.DECEL)
            : Optional.empty();
  }

  /** Recent-5d hit-rate minus prior-15d baseline hit-rate, expressed in percentage points. */
  private int velocityPercentagePoints(BigDecimal persistence5d, BigDecimal persistence20d) {
    double rate5d = persistence5d.doubleValue() / 5.0;
    double rate15 = (persistence20d.doubleValue() - persistence5d.doubleValue()) / 15.0;
    return (int) Math.round((rate5d - rate15) * 100);
  }

  private boolean notAlreadyAlerted(Breach breach) {
    return !alertRepository.existsActiveAlert(breach.direction().ruleId, breach.categoryId());
  }

  private void fire(Breach breach, Severity severity, LocalDate signalDate) {
    Direction direction = breach.direction();
    int velocityPp = breach.velocityPp();
    int p5 = breach.persistence5d().intValue();
    int p20 = breach.persistence20d().intValue();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            breach.category(),
            direction.ruleId,
            severity,
            String.format(
                "%s breadth velocity %spp — recent-5d hit-rate sharply %s prior-15d baseline (P5=%d, P20=%d)",
                breach.categoryId(), direction.label(velocityPp), direction.comparison, p5, p20),
            String.format(
                "{\"velocityPp\":%d,\"persistence5d\":%d,\"persistence20d\":%d,\"signalDate\":\"%s\"}",
                velocityPp, p5, p20, signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "{}: category={} velocityPp={} p5d={} p20d={}",
        direction.ruleId,
        breach.categoryId(),
        velocityPp,
        p5,
        p20);
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("breadth_velocity: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  /** A sector whose 5-day breadth velocity crossed the accel/decel threshold. */
  private record Breach(
      String categoryId,
      CategoryId category,
      Direction direction,
      int velocityPp,
      BigDecimal persistence5d,
      BigDecimal persistence20d) {}

  private enum Direction {
    ACCEL("breadth_velocity_accel", "above"),
    DECEL("breadth_velocity_decel", "below");

    private final String ruleId;
    private final String comparison;

    Direction(String ruleId, String comparison) {
      this.ruleId = ruleId;
      this.comparison = comparison;
    }

    /** Signed percentage-point label — accel shows an explicit "+". */
    String label(int velocityPp) {
      return this == ACCEL ? "+" + velocityPp : String.valueOf(velocityPp);
    }
  }
}

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
 * Fires when a sector's short-term relative strength (RS-20 vs RS-60) contradicts its medium-term
 * relative strength (RS-60 vs RS-120):
 *
 * <ul>
 *   <li><b>Counter-trend bounce</b> — short-term strength inside a structurally weak sector (fading
 *       risk).
 *   <li><b>Pullback in a bull</b> — short-term weakness inside a structurally strong sector
 *       (potential entry).
 * </ul>
 *
 * Resolves when the two horizons realign.
 */
@Component
public class CrossHorizonRsDivergenceAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(CrossHorizonRsDivergenceAlertEvaluator.class);

  private static final String RULE_CROSS_HORIZON_RS_DIV = "cross_horizon_rs_divergence";
  private static final double CROSS_HORIZON_RS_MIN_GAP = 0.001;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public CrossHorizonRsDivergenceAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_CROSS_HORIZON_RS_DIV);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Snapshot snapshot = loadSnapshot(signalDate);
    if (snapshot.isIncomplete()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<Assessment> assessed =
        context.equityCategoryIds().stream()
            .map(categoryId -> assess(categoryId, snapshot))
            .flatMap(Optional::stream)
            .toList();

    assessed.stream().filter(Assessment::shouldFire).forEach(a -> fire(a, severity, signalDate));
    assessed.stream().filter(Assessment::shouldResolve).forEach(this::resolve);
    return (int) assessed.stream().filter(Assessment::shouldFire).count();
  }

  private Optional<Assessment> assess(String categoryId, Snapshot snapshot) {
    BigDecimal rs20 = snapshot.rs20().get(categoryId);
    BigDecimal rs60 = snapshot.rs60().get(categoryId);
    BigDecimal rs120 = snapshot.rs120().get(categoryId);
    if (rs20 == null || rs60 == null || rs120 == null) {
      return Optional.empty();
    }
    Optional<Divergence> divergence = detect(rs20.doubleValue(), rs60.doubleValue(), rs120.doubleValue());
    boolean active = alertRepository.existsActiveAlert(RULE_CROSS_HORIZON_RS_DIV, categoryId);
    return Optional.of(
        new Assessment(categoryId, knownCategory(categoryId), rs20, rs60, rs120, divergence, active));
  }

  private Optional<Divergence> detect(double rs20, double rs60, double rs120) {
    boolean shortTermBull = rs20 > rs60 + CROSS_HORIZON_RS_MIN_GAP;
    boolean shortTermBear = rs20 < rs60 - CROSS_HORIZON_RS_MIN_GAP;
    boolean medTermBull = rs60 > rs120 + CROSS_HORIZON_RS_MIN_GAP;
    boolean medTermBear = rs60 < rs120 - CROSS_HORIZON_RS_MIN_GAP;
    return shortTermBull && medTermBear
        ? Optional.of(Divergence.COUNTER_TREND_BOUNCE)
        : shortTermBear && medTermBull ? Optional.of(Divergence.PULLBACK_IN_BULL) : Optional.empty();
  }

  private void fire(Assessment assessment, Severity severity, LocalDate signalDate) {
    Divergence divergence = assessment.divergence().orElseThrow();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            assessment.category().orElseThrow(),
            RULE_CROSS_HORIZON_RS_DIV,
            severity,
            divergence.message(assessment.categoryId()),
            String.format(
                "{\"rs20\":%.4f,\"rs60\":%.4f,\"rs120\":%.4f,\"divergenceType\":\"%s\",\"signalDate\":\"%s\"}",
                assessment.rs20().doubleValue(),
                assessment.rs60().doubleValue(),
                assessment.rs120().doubleValue(),
                divergence.name(),
                signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "cross_horizon_rs_divergence: category={} type={} rs20={} rs60={} rs120={}",
        assessment.categoryId(),
        divergence.name(),
        assessment.rs20(),
        assessment.rs60(),
        assessment.rs120());
  }

  private void resolve(Assessment assessment) {
    alertRepository.resolveAlertsByRuleAndCategory(RULE_CROSS_HORIZON_RS_DIV, assessment.categoryId());
    log.info(
        "cross_horizon_rs_divergence: resolved for category={} (horizons aligned)",
        assessment.categoryId());
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("cross_horizon_rs_divergence: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  private Snapshot loadSnapshot(LocalDate signalDate) {
    return new Snapshot(
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate),
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate),
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate));
  }

  /** The three RS-horizon maps needed on a single date. */
  private record Snapshot(
      Map<String, BigDecimal> rs20, Map<String, BigDecimal> rs60, Map<String, BigDecimal> rs120) {
    boolean isIncomplete() {
      return rs20.isEmpty() || rs60.isEmpty() || rs120.isEmpty();
    }
  }

  /** One sector's cross-horizon verdict for the day. */
  private record Assessment(
      String categoryId,
      Optional<CategoryId> category,
      BigDecimal rs20,
      BigDecimal rs60,
      BigDecimal rs120,
      Optional<Divergence> divergence,
      boolean hasActiveAlert) {

    boolean shouldFire() {
      return divergence.isPresent() && category.isPresent() && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return divergence.isEmpty() && hasActiveAlert;
    }
  }

  private enum Divergence {
    COUNTER_TREND_BOUNCE(
        "%s short-term RS spiking while medium-term RS downtrend persists — counter-trend bounce, fading risk"),
    PULLBACK_IN_BULL(
        "%s short-term RS softening while medium-term RS uptrend intact — pullback in a bull, potential entry");

    private final String messageTemplate;

    Divergence(String messageTemplate) {
      this.messageTemplate = messageTemplate;
    }

    String message(String categoryId) {
      return String.format(messageTemplate, categoryId);
    }
  }
}

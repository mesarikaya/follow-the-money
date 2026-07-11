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
 * Fires when the RRG quadrant direction contradicts RS-20 vs RS-60 momentum — an early warning that
 * the RRG chart is about to catch up:
 *
 * <ul>
 *   <li><b>Bearish divergence</b> — RRG Leading/Improving (says strong) but RS-20 &lt; RS-60
 *       (momentum already cracking).
 *   <li><b>Bullish divergence</b> — RRG Lagging/Weakening (says weak) but RS-20 &gt; RS-60
 *       (momentum already recovering).
 * </ul>
 *
 * Resolves when the divergence closes (RS-20/RS-60 realigns with the RRG direction).
 */
@Component
public class RrgRsDivergenceAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(RrgRsDivergenceAlertEvaluator.class);

  private static final String RULE_RRG_RS_DIVERGENCE = "rrg_rs_divergence";

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public RrgRsDivergenceAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_RRG_RS_DIVERGENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    LocalDate signalDate = context.signalDate();
    Snapshot snapshot = loadSnapshot(signalDate);
    if (snapshot.isIncomplete()) {
      return 0;
    }

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
    BigDecimal rrgRaw = snapshot.rrg().get(categoryId);
    BigDecimal rs20 = snapshot.rs20().get(categoryId);
    BigDecimal rs60 = snapshot.rs60().get(categoryId);
    if (rrgRaw == null || rs20 == null || rs60 == null) {
      return Optional.empty();
    }
    int quadrant = rrgRaw.intValue();
    Optional<Divergence> divergence = detect(quadrant, rs20, rs60);
    boolean active = alertRepository.existsActiveAlert(RULE_RRG_RS_DIVERGENCE, categoryId);
    return Optional.of(
        new Assessment(categoryId, knownCategory(categoryId), quadrant, rs20, rs60, divergence, active));
  }

  private Optional<Divergence> detect(int quadrant, BigDecimal rs20, BigDecimal rs60) {
    boolean rrgBullish = quadrant == 3 || quadrant == 4;
    boolean rrgBearish = quadrant == 1 || quadrant == 2;
    int momentum = rs20.compareTo(rs60);
    return rrgBullish && momentum < 0
        ? Optional.of(Divergence.BEARISH)
        : rrgBearish && momentum > 0 ? Optional.of(Divergence.BULLISH) : Optional.empty();
  }

  private void fire(Assessment assessment, Severity severity, LocalDate signalDate) {
    Divergence divergence = assessment.divergence().orElseThrow();
    int quadrant = assessment.quadrant();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            assessment.category().orElseThrow(),
            RULE_RRG_RS_DIVERGENCE,
            severity,
            String.format(
                "%s %s: %s",
                assessment.categoryId(), divergence.label, divergence.explain(rrgLabel(quadrant), quadrant)),
            String.format(
                "{\"rrgQuadrant\":%d,\"rs20\":%.4f,\"rs60\":%.4f,\"divergenceType\":\"%s\",\"signalDate\":\"%s\"}",
                quadrant,
                assessment.rs20().doubleValue(),
                assessment.rs60().doubleValue(),
                divergence.label,
                signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "rrg_rs_divergence: category={} type={} rrg={} rs20={} rs60={}",
        assessment.categoryId(),
        divergence.label,
        quadrant,
        assessment.rs20(),
        assessment.rs60());
  }

  private void resolve(Assessment assessment) {
    alertRepository.resolveAlertsByRuleAndCategory(RULE_RRG_RS_DIVERGENCE, assessment.categoryId());
    log.info(
        "rrg_rs_divergence: resolved for category={} (divergence closed)", assessment.categoryId());
  }

  private String rrgLabel(int quadrant) {
    return switch (quadrant) {
      case 4 -> "Leading";
      case 3 -> "Improving";
      case 2 -> "Weakening";
      default -> "Lagging";
    };
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("rrg_rs_divergence: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  private Snapshot loadSnapshot(LocalDate signalDate) {
    return new Snapshot(
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate),
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate),
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate));
  }

  /** The signal maps needed to assess divergence on a single date. */
  private record Snapshot(
      Map<String, BigDecimal> rrg, Map<String, BigDecimal> rs20, Map<String, BigDecimal> rs60) {
    boolean isIncomplete() {
      return rrg.isEmpty() || rs20.isEmpty() || rs60.isEmpty();
    }
  }

  /** One sector's divergence verdict for the day. */
  private record Assessment(
      String categoryId,
      Optional<CategoryId> category,
      int quadrant,
      BigDecimal rs20,
      BigDecimal rs60,
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
    BEARISH(
        "BEARISH DIVERGENCE",
        "RRG %s (Q%d) but RS-20 already below RS-60 — momentum cracking before chart shows it"),
    BULLISH(
        "BULLISH DIVERGENCE",
        "RRG %s (Q%d) but RS-20 already above RS-60 — momentum recovering before chart shows it");

    private final String label;
    private final String explanationTemplate;

    Divergence(String label, String explanationTemplate) {
      this.label = label;
      this.explanationTemplate = explanationTemplate;
    }

    String explain(String rrgLabel, int quadrant) {
      return String.format(explanationTemplate, rrgLabel, quadrant);
    }
  }
}

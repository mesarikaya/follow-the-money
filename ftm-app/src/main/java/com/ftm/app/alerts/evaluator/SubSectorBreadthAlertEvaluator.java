package com.ftm.app.alerts.evaluator;

import com.ftm.app.api.repository.CategoryRepository;
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
 * Two sub-sector breadth rules over a parent sector's children RRG quadrants:
 *
 * <ul>
 *   <li><b>sub_sector_breadth_divergence</b> — a sector has an active BUY signal but &lt;40% of its
 *       sub-sectors are Leading/Improving: the top-level signal lacks internal confirmation and may
 *       be fragile. Resolves when breadth recovers to ≥55% or the parent BUY signal is gone.
 *   <li><b>sub_sector_bull_confluence</b> — ≥75% of a sector's sub-sectors are Leading/Improving:
 *       an internally confirmed rotation. Resolves when breadth falls below 55%.
 * </ul>
 *
 * Both share the child-quadrant lookup; a sector with fewer than two sub-sectors is skipped (its
 * divergence alert resolved if one was active).
 */
@Component
public class SubSectorBreadthAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(SubSectorBreadthAlertEvaluator.class);

  private static final String RULE_SUB_SECTOR_BREADTH_DIV = "sub_sector_breadth_divergence";
  private static final String RULE_SUB_SECTOR_BULL_CONFLUENCE = "sub_sector_bull_confluence";
  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";

  private static final int SUB_SECTOR_MIN_COUNT = 2;
  private static final double SUB_SECTOR_BREADTH_FIRE_FRACTION = 0.40;
  private static final double SUB_SECTOR_BREADTH_RESOLVE_FRACTION = 0.55;
  private static final double SUB_SECTOR_BULL_CONFLUENCE_FIRE_FRACTION = 0.75;
  private static final double SUB_SECTOR_BULL_CONFLUENCE_RESOLVE_FRACTION = 0.55;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;
  private final CategoryRepository categoryRepository;

  public SubSectorBreadthAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository,
      CategoryRepository categoryRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
    this.categoryRepository = categoryRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    return evaluateBreadthDivergence(context) + evaluateBullConfluence(context);
  }

  private int evaluateBreadthDivergence(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SUB_SECTOR_BREADTH_DIV);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    List<Verdict> verdicts =
        context.equityCategoryIds().stream()
            .map(categoryId -> divergenceVerdict(categoryId, rrgMap))
            .flatMap(Optional::stream)
            .toList();

    verdicts.stream().filter(Verdict::fire).forEach(v -> fireDivergence(v, severity, signalDate));
    verdicts.stream()
        .filter(Verdict::resolve)
        .forEach(v -> resolve(RULE_SUB_SECTOR_BREADTH_DIV, v.categoryId()));
    return (int) verdicts.stream().filter(Verdict::fire).count();
  }

  private int evaluateBullConfluence(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SUB_SECTOR_BULL_CONFLUENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    List<Verdict> verdicts =
        context.equityCategoryIds().stream()
            .map(categoryId -> confluenceVerdict(categoryId, rrgMap))
            .flatMap(Optional::stream)
            .toList();

    verdicts.stream().filter(Verdict::fire).forEach(v -> fireConfluence(v, severity, signalDate));
    verdicts.stream()
        .filter(Verdict::resolve)
        .forEach(v -> resolve(RULE_SUB_SECTOR_BULL_CONFLUENCE, v.categoryId()));
    return (int) verdicts.stream().filter(Verdict::fire).count();
  }

  private Optional<Verdict> divergenceVerdict(String categoryId, Map<String, BigDecimal> rrgMap) {
    return measure(categoryId, RULE_SUB_SECTOR_BREADTH_DIV, rrgMap)
        .map(
            measurement -> {
              boolean active =
                  alertRepository.existsActiveAlert(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);
              if (!measurement.sufficient()) {
                return Verdict.resolveOnly(categoryId, active);
              }
              boolean hasBuyAlert =
                  alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId);
              double breadth = measurement.breadth();
              Optional<CategoryId> category = knownCategory(categoryId);
              boolean fire =
                  hasBuyAlert
                      && breadth < SUB_SECTOR_BREADTH_FIRE_FRACTION
                      && !active
                      && category.isPresent();
              boolean resolve =
                  active && (!hasBuyAlert || breadth >= SUB_SECTOR_BREADTH_RESOLVE_FRACTION);
              return new Verdict(categoryId, category, measurement, fire, resolve);
            });
  }

  private Optional<Verdict> confluenceVerdict(String categoryId, Map<String, BigDecimal> rrgMap) {
    return measure(categoryId, RULE_SUB_SECTOR_BULL_CONFLUENCE, rrgMap)
        .map(
            measurement -> {
              boolean active =
                  alertRepository.existsActiveAlert(RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);
              if (!measurement.sufficient()) {
                return Verdict.resolveOnly(categoryId, active);
              }
              double breadth = measurement.breadth();
              Optional<CategoryId> category = knownCategory(categoryId);
              boolean fire =
                  breadth >= SUB_SECTOR_BULL_CONFLUENCE_FIRE_FRACTION && !active && category.isPresent();
              boolean resolve = active && breadth < SUB_SECTOR_BULL_CONFLUENCE_RESOLVE_FRACTION;
              return new Verdict(categoryId, category, measurement, fire, resolve);
            });
  }

  private void fireDivergence(Verdict verdict, Severity severity, LocalDate signalDate) {
    Measurement measurement = verdict.measurement();
    int breadthPct = measurement.breadthPercent();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            verdict.category().orElseThrow(),
            RULE_SUB_SECTOR_BREADTH_DIV,
            severity,
            String.format(
                "%s BUY signal has weak sub-sector breadth: only %d%% of sub-sectors are in Leading/Improving RRG (%d/%d) — sector signal may lack internal confirmation",
                verdict.categoryId(), breadthPct, measurement.bullishCount(), measurement.total()),
            String.format(
                "{\"parentSignal\":\"BUY\",\"subBreadth\":%.2f,\"bullishCount\":%d,\"totalSubSectors\":%d,\"signalDate\":\"%s\"}",
                measurement.breadth(), measurement.bullishCount(), measurement.total(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "sub_sector_breadth_divergence: fired category={} breadth={}% ({}/{})",
        verdict.categoryId(), breadthPct, measurement.bullishCount(), measurement.total());
  }

  private void fireConfluence(Verdict verdict, Severity severity, LocalDate signalDate) {
    Measurement measurement = verdict.measurement();
    int breadthPct = measurement.breadthPercent();
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            verdict.category().orElseThrow(),
            RULE_SUB_SECTOR_BULL_CONFLUENCE,
            severity,
            String.format(
                "%s has broad sub-sector confluence: %d%% of sub-sectors in Leading/Improving RRG (%d/%d) — internally confirmed sector rotation",
                verdict.categoryId(), breadthPct, measurement.bullishCount(), measurement.total()),
            String.format(
                "{\"subBreadth\":%.2f,\"bullishCount\":%d,\"totalSubSectors\":%d,\"signalDate\":\"%s\"}",
                measurement.breadth(), measurement.bullishCount(), measurement.total(), signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "sub_sector_bull_confluence: fired category={} breadth={}% ({}/{})",
        verdict.categoryId(), breadthPct, measurement.bullishCount(), measurement.total());
  }

  private void resolve(String ruleId, String categoryId) {
    alertRepository.resolveAlertsByRuleAndCategory(ruleId, categoryId);
    log.info("{}: resolved category={}", ruleId, categoryId);
  }

  /**
   * Counts a parent's Leading/Improving sub-sectors. Empty when the sub-category enum can't be
   * resolved or fewer than two sub-sectors carry a quadrant; a parent with fewer than two
   * sub-categories yields an {@link Measurement#insufficient() insufficient} measurement (resolve
   * only).
   */
  private Optional<Measurement> measure(
      String categoryId, String ruleId, Map<String, BigDecimal> rrgMap) {
    List<String> subIds = subSectorIds(categoryId, ruleId);
    if (subIds == null) {
      return Optional.empty();
    }
    if (subIds.size() < SUB_SECTOR_MIN_COUNT) {
      return Optional.of(Measurement.insufficient());
    }
    List<BigDecimal> subQuadrants = bullishQuadrants(subIds, rrgMap);
    if (subQuadrants.size() < SUB_SECTOR_MIN_COUNT) {
      return Optional.empty();
    }
    return Optional.of(Measurement.of((int) bullishCount(subQuadrants), subQuadrants.size()));
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  /** A parent sector's sub-sector breadth tally. */
  private record Measurement(boolean sufficient, int bullishCount, int total) {
    static Measurement insufficient() {
      return new Measurement(false, 0, 0);
    }

    static Measurement of(int bullishCount, int total) {
      return new Measurement(true, bullishCount, total);
    }

    double breadth() {
      return (double) bullishCount / total;
    }

    int breadthPercent() {
      return (int) Math.round(breadth() * 100);
    }
  }

  /** Per-sector fire/resolve decision for one of the two rules. */
  private record Verdict(
      String categoryId,
      Optional<CategoryId> category,
      Measurement measurement,
      boolean fire,
      boolean resolve) {

    static Verdict resolveOnly(String categoryId, boolean active) {
      return new Verdict(categoryId, Optional.empty(), Measurement.insufficient(), false, active);
    }
  }

  /** Sub-category ids of a parent, or {@code null} when the sub-category enum can't be resolved. */
  private List<String> subSectorIds(String categoryId, String ruleId) {
    try {
      return categoryRepository.findSubCategoriesByParentId(categoryId).stream()
          .map(c -> c.id().name())
          .toList();
    } catch (IllegalArgumentException e) {
      log.debug("{}: skipping {}, sub-category enum mismatch", ruleId, categoryId);
      return null;
    }
  }

  private List<BigDecimal> bullishQuadrants(List<String> subIds, Map<String, BigDecimal> rrgMap) {
    return subIds.stream().map(rrgMap::get).filter(q -> q != null).toList();
  }

  private long bullishCount(List<BigDecimal> subQuadrants) {
    return subQuadrants.stream().filter(q -> q.intValue() == 3 || q.intValue() == 4).count();
  }
}

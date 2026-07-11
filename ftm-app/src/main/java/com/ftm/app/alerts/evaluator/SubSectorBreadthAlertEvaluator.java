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
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      List<String> subIds = subSectorIds(categoryId, "sub_sector_breadth_divergence");
      if (subIds == null) continue;

      boolean hasActive = alertRepository.existsActiveAlert(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);
      if (subIds.size() < SUB_SECTOR_MIN_COUNT) {
        if (hasActive) {
          alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);
        }
        continue;
      }

      List<BigDecimal> subQuadrants = bullishQuadrants(subIds, rrgMap);
      if (subQuadrants.size() < SUB_SECTOR_MIN_COUNT) continue;

      long bullishCount = bullishCount(subQuadrants);
      double breadth = (double) bullishCount / subQuadrants.size();
      boolean hasBuyAlert = alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId);
      boolean weakBreadth = breadth < SUB_SECTOR_BREADTH_FIRE_FRACTION;

      if (hasBuyAlert && weakBreadth && !hasActive) {
        CategoryId catId = parseCategory(categoryId);
        if (catId == null) continue;
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_SUB_SECTOR_BREADTH_DIV,
                severity,
                String.format(
                    "%s BUY signal has weak sub-sector breadth: only %d%% of sub-sectors are in Leading/Improving RRG (%d/%d) — sector signal may lack internal confirmation",
                    categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size()),
                String.format(
                    "{\"parentSignal\":\"BUY\",\"subBreadth\":%.2f,\"bullishCount\":%d,\"totalSubSectors\":%d,\"signalDate\":\"%s\"}",
                    breadth, (int) bullishCount, subQuadrants.size(), signalDate),
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "sub_sector_breadth_divergence: fired category={} breadth={}% ({}/{})",
            categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size());
      } else if (hasActive && (!hasBuyAlert || breadth >= SUB_SECTOR_BREADTH_RESOLVE_FRACTION)) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BREADTH_DIV, categoryId);
        log.info(
            "sub_sector_breadth_divergence: resolved category={} hasBuyAlert={} breadth={}%",
            categoryId, hasBuyAlert, Math.round(breadth * 100));
      }
    }
    return count;
  }

  private int evaluateBullConfluence(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SUB_SECTOR_BULL_CONFLUENCE);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      List<String> subIds = subSectorIds(categoryId, "sub_sector_bull_confluence");
      if (subIds == null) continue;

      boolean hasActive =
          alertRepository.existsActiveAlert(RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);
      if (subIds.size() < SUB_SECTOR_MIN_COUNT) {
        if (hasActive) {
          alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);
        }
        continue;
      }

      List<BigDecimal> subQuadrants = bullishQuadrants(subIds, rrgMap);
      if (subQuadrants.size() < SUB_SECTOR_MIN_COUNT) continue;

      long bullishCount = bullishCount(subQuadrants);
      double breadth = (double) bullishCount / subQuadrants.size();
      boolean broadConfluence = breadth >= SUB_SECTOR_BULL_CONFLUENCE_FIRE_FRACTION;

      if (broadConfluence && !hasActive) {
        CategoryId catId = parseCategory(categoryId);
        if (catId == null) continue;
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_SUB_SECTOR_BULL_CONFLUENCE,
                severity,
                String.format(
                    "%s has broad sub-sector confluence: %d%% of sub-sectors in Leading/Improving RRG (%d/%d) — internally confirmed sector rotation",
                    categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size()),
                String.format(
                    "{\"subBreadth\":%.2f,\"bullishCount\":%d,\"totalSubSectors\":%d,\"signalDate\":\"%s\"}",
                    breadth, (int) bullishCount, subQuadrants.size(), signalDate),
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "sub_sector_bull_confluence: fired category={} breadth={}% ({}/{})",
            categoryId, Math.round(breadth * 100), (int) bullishCount, subQuadrants.size());
      } else if (hasActive && breadth < SUB_SECTOR_BULL_CONFLUENCE_RESOLVE_FRACTION) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_SUB_SECTOR_BULL_CONFLUENCE, categoryId);
        log.info(
            "sub_sector_bull_confluence: resolved category={} breadth={}%",
            categoryId, Math.round(breadth * 100));
      }
    }
    return count;
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

  private CategoryId parseCategory(String categoryId) {
    try {
      return CategoryId.valueOf(categoryId);
    } catch (IllegalArgumentException e) {
      return null;
    }
  }
}

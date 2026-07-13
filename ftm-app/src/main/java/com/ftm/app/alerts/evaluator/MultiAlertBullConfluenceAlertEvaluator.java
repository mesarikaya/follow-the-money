package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * The meta-alert: fires when a single sector has three or more bullish alerts active at once. Any
 * one of them is ordinary; several at the same time is a rare confluence, and more actionable than
 * any of them alone. Resolves as soon as the sector falls back below the threshold.
 *
 * <p><b>This evaluator must run last.</b> It counts the alerts the other rules created earlier in
 * the same evaluation, so anything raised after it would be missed.
 */
@Component
public class MultiAlertBullConfluenceAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(MultiAlertBullConfluenceAlertEvaluator.class);

  private static final String RULE_MULTI_ALERT_BULL = "multi_alert_bull_confluence";
  private static final int CONFLUENCE_THRESHOLD = 3;

  /** The alerts that count as bullish for the purposes of confluence. */
  private static final List<String> BULL_ALERT_RULES =
      List.of(
          "trade_signal_buy",
          "high_conviction_buy",
          "score_approaching_buy",
          "pre_buy_flow_surge",
          "rs_aligned_bull",
          "breadth_velocity_accel",
          "composite_breakout");

  private final AlertRulesRepository alertRulesRepository;
  private final AlertRepository alertRepository;

  public MultiAlertBullConfluenceAlertEvaluator(
      AlertRulesRepository alertRulesRepository, AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_MULTI_ALERT_BULL);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    int alertsCreated = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      List<String> activeBullRules = activeBullRulesFor(categoryId);
      boolean hasConfluenceAlert =
          alertRepository.existsActiveAlert(RULE_MULTI_ALERT_BULL, categoryId);
      boolean isConfluent = activeBullRules.size() >= CONFLUENCE_THRESHOLD;

      if (isConfluent && !hasConfluenceAlert) {
        alertsCreated += raise(categoryId, activeBullRules, severity);
      } else if (!isConfluent && hasConfluenceAlert) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_MULTI_ALERT_BULL, categoryId);
        log.info(
            "multi_alert_bull_confluence: resolved for category={} (activeCount={})",
            categoryId,
            activeBullRules.size());
      }
    }
    return alertsCreated;
  }

  private List<String> activeBullRulesFor(String categoryId) {
    return BULL_ALERT_RULES.stream()
        .filter(ruleId -> alertRepository.existsActiveAlert(ruleId, categoryId))
        .toList();
  }

  /** @return 1 when an alert was raised, 0 when the category id is not one we know */
  private int raise(String categoryId, List<String> activeBullRules, Severity severity) {
    CategoryId category;
    try {
      category = CategoryId.valueOf(categoryId);
    } catch (IllegalArgumentException notACategory) {
      log.debug("multi_alert_bull_confluence: skipping unknown CategoryId={}", categoryId);
      return 0;
    }

    String ruleList = String.join(", ", activeBullRules);
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            category,
            RULE_MULTI_ALERT_BULL,
            severity,
            String.format(
                "%s: %d bullish signals aligned (%s) — high-confidence rotation setup",
                categoryId, activeBullRules.size(), ruleList),
            String.format(
                "{\"activeCount\":%d,\"rules\":\"%s\"}",
                activeBullRules.size(), String.join(",", activeBullRules)),
            AlertStatus.ACTIVE));
    log.info(
        "multi_alert_bull_confluence: category={} count={} rules=[{}]",
        categoryId,
        activeBullRules.size(),
        ruleList);
    return 1;
  }
}

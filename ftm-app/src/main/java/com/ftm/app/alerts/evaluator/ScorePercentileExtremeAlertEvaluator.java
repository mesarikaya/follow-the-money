package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
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
  private final AlertRepository alertRepository;

  public ScorePercentileExtremeAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_SCORE_PERCENTILE_EXTREME);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.INFO);

    Map<String, BigDecimal> percentiles = signalRepository.findScorePercentile252d();
    if (percentiles.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      BigDecimal pct = percentiles.get(categoryId);
      if (pct == null) continue;
      double p = pct.doubleValue();

      boolean isHigh = p >= SCORE_PERCENTILE_HIGH_FIRE;
      boolean isLow = p <= SCORE_PERCENTILE_LOW_FIRE;
      boolean hasActive =
          alertRepository.existsActiveAlert(RULE_SCORE_PERCENTILE_EXTREME, categoryId);
      boolean isExtreme = isHigh || isLow;
      boolean isNormal = p < SCORE_PERCENTILE_HIGH_RESOLVE && p > SCORE_PERCENTILE_LOW_RESOLVE;

      if (isExtreme && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("score_percentile_extreme: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String direction = isHigh ? "HIGH" : "LOW";
        String message =
            isHigh
                ? String.format(
                    "%s composite at 252d HIGH (%.0fth pct) — historically stretched, mean-reversion risk",
                    categoryId, p * 100)
                : String.format(
                    "%s composite at 252d LOW (%.0fth pct) — historically depressed, turnaround watch",
                    categoryId, p * 100);
        String snapshot =
            String.format("{\"percentile252d\":%.4f,\"direction\":\"%s\"}", p, direction);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_SCORE_PERCENTILE_EXTREME,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        log.info(
            "score_percentile_extreme: category={} direction={} percentile={}",
            categoryId,
            direction,
            p);
        count++;
      } else if (isNormal && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_SCORE_PERCENTILE_EXTREME, categoryId);
        log.info(
            "score_percentile_extreme: resolved for category={} (percentile={} returned to normal)",
            categoryId,
            p);
      }
    }
    return count;
  }
}

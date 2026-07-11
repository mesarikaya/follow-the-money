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
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> rs20Map =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> rs60Map =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    Map<String, BigDecimal> rs120Map =
        signalRepository.findByTypeAndDate(SignalType.RS_120, signalDate);
    if (rs20Map.isEmpty() || rs60Map.isEmpty() || rs120Map.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      BigDecimal rs20 = rs20Map.get(categoryId);
      BigDecimal rs60 = rs60Map.get(categoryId);
      BigDecimal rs120 = rs120Map.get(categoryId);
      if (rs20 == null || rs60 == null || rs120 == null) continue;

      double r20 = rs20.doubleValue();
      double r60 = rs60.doubleValue();
      double r120 = rs120.doubleValue();

      boolean shortTermBull = r20 > r60 + CROSS_HORIZON_RS_MIN_GAP;
      boolean shortTermBear = r20 < r60 - CROSS_HORIZON_RS_MIN_GAP;
      boolean medTermBull = r60 > r120 + CROSS_HORIZON_RS_MIN_GAP;
      boolean medTermBear = r60 < r120 - CROSS_HORIZON_RS_MIN_GAP;

      boolean counterTrendBounce = shortTermBull && medTermBear; // strength in weak sector
      boolean pullbackInBull = shortTermBear && medTermBull; // weakness in strong sector
      boolean hasDivergence = counterTrendBounce || pullbackInBull;
      boolean hasActive = alertRepository.existsActiveAlert(RULE_CROSS_HORIZON_RS_DIV, categoryId);

      if (hasDivergence && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("cross_horizon_rs_divergence: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String divergenceType = counterTrendBounce ? "COUNTER_TREND_BOUNCE" : "PULLBACK_IN_BULL";
        String message =
            counterTrendBounce
                ? String.format(
                    "%s short-term RS spiking while medium-term RS downtrend persists — counter-trend bounce, fading risk",
                    categoryId)
                : String.format(
                    "%s short-term RS softening while medium-term RS uptrend intact — pullback in a bull, potential entry",
                    categoryId);
        String snapshot =
            String.format(
                "{\"rs20\":%.4f,\"rs60\":%.4f,\"rs120\":%.4f,\"divergenceType\":\"%s\",\"signalDate\":\"%s\"}",
                r20, r60, r120, divergenceType, signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_CROSS_HORIZON_RS_DIV,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "cross_horizon_rs_divergence: category={} type={} rs20={} rs60={} rs120={}",
            categoryId,
            divergenceType,
            rs20,
            rs60,
            rs120);
      } else if (!hasDivergence && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_CROSS_HORIZON_RS_DIV, categoryId);
        log.info(
            "cross_horizon_rs_divergence: resolved for category={} (horizons aligned)", categoryId);
      }
    }
    return count;
  }
}

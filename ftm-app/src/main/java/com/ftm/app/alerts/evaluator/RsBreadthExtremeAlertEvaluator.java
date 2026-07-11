package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
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
 * A market-wide breadth alert: fires BULL when a broad majority (≥60%) of equity sectors have RS-20
 * above RS-60 (short-term momentum alignment), and BEAR when a majority have RS-20 below RS-60
 * (broad deterioration). Each direction resolves when its fraction falls back below 45%.
 */
@Component
public class RsBreadthExtremeAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(RsBreadthExtremeAlertEvaluator.class);

  private static final String RULE_RS_BREADTH_BULL = "rs_breadth_bull";
  private static final String RULE_RS_BREADTH_BEAR = "rs_breadth_bear";
  private static final double RS_BREADTH_FIRE_FRACTION = 0.60;
  private static final double RS_BREADTH_RESOLVE_FRACTION = 0.45;

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public RsBreadthExtremeAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    LocalDate signalDate = context.signalDate();

    // Check rules first — avoid data fetch when both are disabled
    Optional<AlertRule> bullRule = alertRulesRepository.findById(RULE_RS_BREADTH_BULL);
    Optional<AlertRule> bearRule = alertRulesRepository.findById(RULE_RS_BREADTH_BEAR);
    boolean bullEnabled = bullRule.map(AlertRule::enabled).orElse(false);
    boolean bearEnabled = bearRule.map(AlertRule::enabled).orElse(false);
    if (!bullEnabled && !bearEnabled) return 0;

    Map<String, BigDecimal> rs20Map =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> rs60Map =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    if (rs20Map.isEmpty() || rs60Map.isEmpty()) return 0;

    int total = 0;
    int bullCount = 0;
    int bearCount = 0;
    for (String categoryId : context.equityCategoryIds()) {
      BigDecimal r20 = rs20Map.get(categoryId);
      BigDecimal r60 = rs60Map.get(categoryId);
      if (r20 == null || r60 == null) continue;
      total++;
      int cmp = r20.compareTo(r60);
      if (cmp > 0) bullCount++;
      else if (cmp < 0) bearCount++;
    }
    if (total == 0) return 0;

    double bullFraction = (double) bullCount / total;
    double bearFraction = (double) bearCount / total;
    int count = 0;

    if (bullEnabled) {
      Severity sev = bullRule.map(AlertRule::severity).orElse(Severity.INFO);
      boolean hasActive = alertRepository.existsActiveAlert(RULE_RS_BREADTH_BULL, null);
      if (bullFraction >= RS_BREADTH_FIRE_FRACTION && !hasActive) {
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                null,
                RULE_RS_BREADTH_BULL,
                sev,
                String.format(
                    "RS BREADTH BULL: %d/%d equity sectors (%.0f%%) have RS-20 > RS-60 — broad short-term momentum alignment",
                    bullCount, total, bullFraction * 100),
                String.format(
                    "{\"bullCount\":%d,\"total\":%d,\"fraction\":%.2f,\"signalDate\":\"%s\"}",
                    bullCount, total, bullFraction, signalDate),
                AlertStatus.ACTIVE));
        log.info("rs_breadth_bull: bullCount={}/{} fraction={}", bullCount, total, bullFraction);
        count++;
      } else if (bullFraction < RS_BREADTH_RESOLVE_FRACTION && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_RS_BREADTH_BULL, null);
        log.info("rs_breadth_bull: resolved, fraction dropped to {}", bullFraction);
      }
    }

    if (bearEnabled) {
      Severity sev = bearRule.map(AlertRule::severity).orElse(Severity.WARNING);
      boolean hasActive = alertRepository.existsActiveAlert(RULE_RS_BREADTH_BEAR, null);
      if (bearFraction >= RS_BREADTH_FIRE_FRACTION && !hasActive) {
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                null,
                RULE_RS_BREADTH_BEAR,
                sev,
                String.format(
                    "RS BREADTH BEAR: %d/%d equity sectors (%.0f%%) have RS-20 < RS-60 — broad momentum deterioration across market",
                    bearCount, total, bearFraction * 100),
                String.format(
                    "{\"bearCount\":%d,\"total\":%d,\"fraction\":%.2f,\"signalDate\":\"%s\"}",
                    bearCount, total, bearFraction, signalDate),
                AlertStatus.ACTIVE));
        log.info("rs_breadth_bear: bearCount={}/{} fraction={}", bearCount, total, bearFraction);
        count++;
      } else if (bearFraction < RS_BREADTH_RESOLVE_FRACTION && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_RS_BREADTH_BEAR, null);
        log.info("rs_breadth_bear: resolved, fraction dropped to {}", bearFraction);
      }
    }

    return count;
  }
}

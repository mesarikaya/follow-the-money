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
 * Fires when a sector is in the pre-BUY approach zone (composite 0.55–0.65) AND institutional flow
 * is surging (FLOW_20D z-score ≥ 1.5) — institutions positioning ahead of the formal BUY signal.
 * Suppressed when a formal BUY trade-signal alert is already active. Resolution (approach zone exit
 * or flow dissipation) is handled centrally by the engine's stale-alert sweep.
 */
@Component
public class PreBuyFlowSurgeAlertEvaluator implements AlertEvaluator {

  private static final Logger log = LoggerFactory.getLogger(PreBuyFlowSurgeAlertEvaluator.class);

  private static final String RULE_PRE_BUY_FLOW_SURGE = "pre_buy_flow_surge";
  private static final String RULE_TRADE_SIGNAL_BUY = "trade_signal_buy";
  private static final BigDecimal BUY_SCORE_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal APPROACHING_BUY_LOWER = new BigDecimal("0.55");
  private static final BigDecimal PRE_BUY_FLOW_SURGE_Z_THRESHOLD = new BigDecimal("1.5");
  private static final BigDecimal ONE_HUNDRED = BigDecimal.valueOf(100);

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public PreBuyFlowSurgeAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_PRE_BUY_FLOW_SURGE);
    if (rule.isEmpty() || !rule.get().enabled()) return 0;
    Severity severity = rule.get().severity();

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> composite =
        signalRepository.findByTypeAndDate(SignalType.COMPOSITE, signalDate);
    Map<String, BigDecimal> flow20d =
        signalRepository.findByTypeAndDate(SignalType.FLOW_20D, signalDate);
    Map<String, BigDecimal> rrgQuadrant =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    if (composite.isEmpty() || flow20d.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.topLevelCategoryIds()) {
      BigDecimal score = composite.get(categoryId);
      BigDecimal flowZ = flow20d.get(categoryId);
      if (score == null || flowZ == null) continue;

      boolean inApproachZone =
          score.compareTo(APPROACHING_BUY_LOWER) >= 0 && score.compareTo(BUY_SCORE_THRESHOLD) < 0;
      boolean flowSurging = flowZ.compareTo(PRE_BUY_FLOW_SURGE_Z_THRESHOLD) >= 0;
      if (!inApproachZone || !flowSurging) continue;
      if (alertRepository.existsActiveAlert(RULE_PRE_BUY_FLOW_SURGE, categoryId)) continue;
      if (alertRepository.existsActiveAlert(RULE_TRADE_SIGNAL_BUY, categoryId)) continue;

      CategoryId catId;
      try {
        catId = CategoryId.valueOf(categoryId);
      } catch (IllegalArgumentException e) {
        log.debug("pre_buy_flow_surge: skipping unknown CategoryId={}", categoryId);
        continue;
      }

      int scorePct = score.multiply(ONE_HUNDRED).intValue();
      int ptsNeeded = BUY_SCORE_THRESHOLD.multiply(ONE_HUNDRED).intValue() - scorePct;
      BigDecimal rrg = rrgQuadrant.get(categoryId);
      int rrgInt = rrg != null ? rrg.intValue() : 0;
      String rrgLabel =
          switch (rrgInt) {
            case 4 -> "Leading";
            case 3 -> "Improving";
            case 2 -> "Weakening";
            case 1 -> "Lagging";
            default -> "Unknown";
          };

      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              catId,
              RULE_PRE_BUY_FLOW_SURGE,
              severity,
              String.format(
                  "%s pre-BUY flow surge: score=%d (need +%dpts for BUY), flow z=+%.1fσ — institutions positioning ahead of signal, RRG %s",
                  categoryId, scorePct, ptsNeeded, flowZ.doubleValue(), rrgLabel),
              String.format(
                  "{\"score\":%d,\"ptsNeeded\":%d,\"flowZ\":%.2f,\"rrgQuadrant\":%d,\"signalDate\":\"%s\"}",
                  scorePct, ptsNeeded, flowZ.doubleValue(), rrgInt, signalDate),
              AlertStatus.ACTIVE));
      count++;
      log.info(
          "pre_buy_flow_surge: category={} score={} ptsNeeded={} flowZ={}",
          categoryId,
          scorePct,
          ptsNeeded,
          flowZ);
    }
    return count;
  }
}

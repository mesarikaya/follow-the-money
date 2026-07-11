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
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    Map<String, BigDecimal> rs20Map =
        signalRepository.findByTypeAndDate(SignalType.RS_20, signalDate);
    Map<String, BigDecimal> rs60Map =
        signalRepository.findByTypeAndDate(SignalType.RS_60, signalDate);
    if (rrgMap.isEmpty() || rs20Map.isEmpty() || rs60Map.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      BigDecimal rrgRaw = rrgMap.get(categoryId);
      BigDecimal rs20 = rs20Map.get(categoryId);
      BigDecimal rs60 = rs60Map.get(categoryId);
      if (rrgRaw == null || rs20 == null || rs60 == null) continue;

      int rrg = rrgRaw.intValue();
      boolean rrgBullish = rrg == 3 || rrg == 4; // Improving or Leading
      boolean rrgBearish = rrg == 1 || rrg == 2; // Lagging or Weakening
      int rsCmp = rs20.compareTo(rs60);
      boolean rsMomentumBullish = rsCmp > 0; // RS-20 > RS-60: short-term outpacing medium-term
      boolean rsMomentumBearish = rsCmp < 0;

      boolean bearishDivergence = rrgBullish && rsMomentumBearish; // RRG says strong, RS cracks
      boolean bullishDivergence = rrgBearish && rsMomentumBullish; // RRG says weak, RS recovers
      boolean anyDivergence = bearishDivergence || bullishDivergence;
      boolean hasActive = alertRepository.existsActiveAlert(RULE_RRG_RS_DIVERGENCE, categoryId);

      if (anyDivergence && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("rrg_rs_divergence: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String rrgLabel =
            rrg == 4 ? "Leading" : rrg == 3 ? "Improving" : rrg == 2 ? "Weakening" : "Lagging";
        String divergenceType = bearishDivergence ? "BEARISH DIVERGENCE" : "BULLISH DIVERGENCE";
        String explanation =
            bearishDivergence
                ? String.format(
                    "RRG %s (Q%d) but RS-20 already below RS-60 — momentum cracking before chart shows it",
                    rrgLabel, rrg)
                : String.format(
                    "RRG %s (Q%d) but RS-20 already above RS-60 — momentum recovering before chart shows it",
                    rrgLabel, rrg);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_RRG_RS_DIVERGENCE,
                severity,
                String.format("%s %s: %s", categoryId, divergenceType, explanation),
                String.format(
                    "{\"rrgQuadrant\":%d,\"rs20\":%.4f,\"rs60\":%.4f,\"divergenceType\":\"%s\",\"signalDate\":\"%s\"}",
                    rrg, rs20.doubleValue(), rs60.doubleValue(), divergenceType, signalDate),
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "rrg_rs_divergence: category={} type={} rrg={} rs20={} rs60={}",
            categoryId,
            divergenceType,
            rrg,
            rs20,
            rs60);
      } else if (!anyDivergence && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_RRG_RS_DIVERGENCE, categoryId);
        log.info("rrg_rs_divergence: resolved for category={} (divergence closed)", categoryId);
      }
    }
    return count;
  }
}

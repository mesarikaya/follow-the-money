package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Fires when a cyclical sector (TECH, DISR, FINL, INDU, ENRG, MATL) is in RRG Leading/Improving
 * (quadrant 3/4) while the macro regime is risk-off (STAGFLATION or RISK_OFF_FLIGHT). A cyclical
 * sector leading during a risk-off backdrop is anomalous — either the market is early-pricing a
 * recovery or the RRG signal is a false leader about to reverse. Resolves when the regime returns to
 * risk-on or the sector exits quadrant 3/4.
 */
@Component
public class MacroSectorMismatchAlertEvaluator implements AlertEvaluator {

  private static final Logger log =
      LoggerFactory.getLogger(MacroSectorMismatchAlertEvaluator.class);

  private static final String RULE_MACRO_SECTOR_MISMATCH = "macro_sector_mismatch";
  private static final Set<String> CYCLICAL_CATEGORY_IDS =
      Set.of("TECH", "DISR", "FINL", "INDU", "ENRG", "MATL");
  // Risk-off macro regime ordinals (STAGFLATION=0, RISK_OFF_FLIGHT=1)
  private static final Set<Integer> RISK_OFF_REGIME_ORDINALS = Set.of(0, 1);

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public MacroSectorMismatchAlertEvaluator(
      AlertRulesRepository alertRulesRepository,
      SignalRepository signalRepository,
      AlertRepository alertRepository) {
    this.alertRulesRepository = alertRulesRepository;
    this.signalRepository = signalRepository;
    this.alertRepository = alertRepository;
  }

  @Override
  public int evaluate(AlertEvaluationContext context) {
    Optional<AlertRule> rule = alertRulesRepository.findById(RULE_MACRO_SECTOR_MISMATCH);
    if (!rule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);

    LocalDate signalDate = context.signalDate();
    Map<String, BigDecimal> regimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, signalDate);
    if (regimeSignals.isEmpty()) return 0;

    BigDecimal regimeRaw = regimeSignals.values().stream().findFirst().orElse(null);
    if (regimeRaw == null) return 0;

    int regimeOrdinal = regimeRaw.intValue();
    boolean isRiskOff = RISK_OFF_REGIME_ORDINALS.contains(regimeOrdinal);
    String regimeName = MacroRegime.nameForOrdinal(regimeOrdinal);

    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    if (rrgMap.isEmpty()) return 0;

    int count = 0;
    for (String categoryId : context.equityCategoryIds()) {
      if (!CYCLICAL_CATEGORY_IDS.contains(categoryId)) continue;

      BigDecimal rrgRaw = rrgMap.get(categoryId);
      if (rrgRaw == null) continue;

      int rrg = rrgRaw.intValue();
      boolean isBullishQuadrant = rrg == 3 || rrg == 4;
      boolean hasMismatch = isRiskOff && isBullishQuadrant;
      boolean hasActive = alertRepository.existsActiveAlert(RULE_MACRO_SECTOR_MISMATCH, categoryId);

      if (hasMismatch && !hasActive) {
        CategoryId catId;
        try {
          catId = CategoryId.valueOf(categoryId);
        } catch (IllegalArgumentException e) {
          log.debug("macro_sector_mismatch: skipping unknown CategoryId={}", categoryId);
          continue;
        }
        String quadrantLabel = rrg == 4 ? "Leading" : "Improving";
        String message =
            String.format(
                "%s cyclical sector in %s RRG while macro regime is %s — anomalous leadership; watch for reversal or early recovery signal",
                categoryId, quadrantLabel, regimeName);
        String snapshot =
            String.format(
                "{\"regimeOrdinal\":%d,\"regime\":\"%s\",\"rrgQuadrant\":%d,\"categoryType\":\"cyclical\",\"signalDate\":\"%s\"}",
                regimeOrdinal, regimeName, rrg, signalDate);
        alertRepository.insert(
            new Alert(
                OffsetDateTime.now(),
                catId,
                RULE_MACRO_SECTOR_MISMATCH,
                severity,
                message,
                snapshot,
                AlertStatus.ACTIVE));
        count++;
        log.info(
            "macro_sector_mismatch: category={} rrg={} regime={}", categoryId, rrg, regimeName);
      } else if (!hasMismatch && hasActive) {
        alertRepository.resolveAlertsByRuleAndCategory(RULE_MACRO_SECTOR_MISMATCH, categoryId);
        log.info(
            "macro_sector_mismatch: resolved for category={} (regime={} or rrg={} changed)",
            categoryId,
            regimeName,
            rrg);
      }
    }
    return count;
  }
}

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
import java.util.List;
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
    if (!rule.map(AlertRule::enabled).orElse(false)) {
      return 0;
    }

    LocalDate signalDate = context.signalDate();
    Optional<Regime> regime = loadRegime(signalDate);
    Map<String, BigDecimal> rrgMap =
        signalRepository.findByTypeAndDate(SignalType.RRG_QUADRANT, signalDate);
    if (regime.isEmpty() || rrgMap.isEmpty()) {
      return 0;
    }

    Severity severity = rule.map(AlertRule::severity).orElse(Severity.WARNING);
    List<Assessment> assessed =
        context.equityCategoryIds().stream()
            .filter(CYCLICAL_CATEGORY_IDS::contains)
            .map(categoryId -> assess(categoryId, rrgMap, regime.get()))
            .flatMap(Optional::stream)
            .toList();

    assessed.stream()
        .filter(Assessment::shouldFire)
        .forEach(assessment -> fire(assessment, severity, regime.get(), signalDate));
    assessed.stream()
        .filter(Assessment::shouldResolve)
        .forEach(assessment -> resolve(assessment, regime.get()));
    return (int) assessed.stream().filter(Assessment::shouldFire).count();
  }

  private Optional<Assessment> assess(String categoryId, Map<String, BigDecimal> rrgMap, Regime regime) {
    BigDecimal rrgRaw = rrgMap.get(categoryId);
    if (rrgRaw == null) {
      return Optional.empty();
    }
    int quadrant = rrgRaw.intValue();
    boolean mismatch = regime.riskOff() && (quadrant == 3 || quadrant == 4);
    boolean active = alertRepository.existsActiveAlert(RULE_MACRO_SECTOR_MISMATCH, categoryId);
    return Optional.of(new Assessment(categoryId, knownCategory(categoryId), quadrant, mismatch, active));
  }

  private void fire(Assessment assessment, Severity severity, Regime regime, LocalDate signalDate) {
    int quadrant = assessment.quadrant();
    String quadrantLabel = quadrant == 4 ? "Leading" : "Improving";
    alertRepository.insert(
        new Alert(
            OffsetDateTime.now(),
            assessment.category().orElseThrow(),
            RULE_MACRO_SECTOR_MISMATCH,
            severity,
            String.format(
                "%s cyclical sector in %s RRG while macro regime is %s — anomalous leadership; watch for reversal or early recovery signal",
                assessment.categoryId(), quadrantLabel, regime.name()),
            String.format(
                "{\"regimeOrdinal\":%d,\"regime\":\"%s\",\"rrgQuadrant\":%d,\"categoryType\":\"cyclical\",\"signalDate\":\"%s\"}",
                regime.ordinal(), regime.name(), quadrant, signalDate),
            AlertStatus.ACTIVE));
    log.info(
        "macro_sector_mismatch: category={} rrg={} regime={}",
        assessment.categoryId(),
        quadrant,
        regime.name());
  }

  private void resolve(Assessment assessment, Regime regime) {
    alertRepository.resolveAlertsByRuleAndCategory(
        RULE_MACRO_SECTOR_MISMATCH, assessment.categoryId());
    log.info(
        "macro_sector_mismatch: resolved for category={} (regime={} or rrg={} changed)",
        assessment.categoryId(),
        regime.name(),
        assessment.quadrant());
  }

  private Optional<CategoryId> knownCategory(String categoryId) {
    try {
      return Optional.of(CategoryId.valueOf(categoryId));
    } catch (IllegalArgumentException e) {
      log.debug("macro_sector_mismatch: skipping unknown CategoryId={}", categoryId);
      return Optional.empty();
    }
  }

  private Optional<Regime> loadRegime(LocalDate signalDate) {
    Map<String, BigDecimal> regimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, signalDate);
    return regimeSignals.values().stream()
        .findFirst()
        .map(BigDecimal::intValue)
        .map(ordinal -> new Regime(ordinal, RISK_OFF_REGIME_ORDINALS.contains(ordinal)));
  }

  /** The day's macro regime: its ordinal, resolved name, and whether it is risk-off. */
  private record Regime(int ordinal, boolean riskOff) {
    String name() {
      return MacroRegime.nameForOrdinal(ordinal);
    }
  }

  /** One cyclical sector's mismatch verdict for the day. */
  private record Assessment(
      String categoryId,
      Optional<CategoryId> category,
      int quadrant,
      boolean mismatch,
      boolean hasActiveAlert) {

    boolean shouldFire() {
      return mismatch && category.isPresent() && !hasActiveAlert;
    }

    boolean shouldResolve() {
      return !mismatch && hasActiveAlert;
    }
  }
}

package com.ftm.app.alerts.evaluator;

import com.ftm.app.alerts.repository.AlertRepository;
import com.ftm.app.alerts.repository.AlertRulesRepository;
import com.ftm.app.domain.Alert;
import com.ftm.app.domain.AlertRule;
import com.ftm.app.domain.AlertStatus;
import com.ftm.app.domain.Severity;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Fires a single alert when the macro regime (the MACRO_REGIME signal) changes from the previous
 * signal date to the current one — e.g. RISK_ON_GROWTH → RISK_OFF_FLIGHT. Only one active
 * regime-shift alert exists at a time.
 */
@Component
public class MacroRegimeShiftAlertEvaluator implements AlertEvaluator {

  private static final String RULE_MACRO_REGIME_SHIFT = "macro_regime_shift";

  private final AlertRulesRepository alertRulesRepository;
  private final SignalRepository signalRepository;
  private final AlertRepository alertRepository;

  public MacroRegimeShiftAlertEvaluator(
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

    Optional<AlertRule> macroRule = alertRulesRepository.findById(RULE_MACRO_REGIME_SHIFT);
    if (!macroRule.map(AlertRule::enabled).orElse(false)) return 0;
    Severity severity = macroRule.map(AlertRule::severity).orElse(Severity.WARNING);

    Map<String, BigDecimal> currentRegimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, signalDate);
    if (currentRegimeSignals.isEmpty()) return 0;

    BigDecimal currentRegimeOrdinal =
        currentRegimeSignals.values().stream().findFirst().orElse(null);
    if (currentRegimeOrdinal == null) return 0;

    LocalDate previousSignalDate =
        signalRepository.findPreviousSignalDate(SignalType.MACRO_REGIME, signalDate);
    if (previousSignalDate == null) return 0;

    Map<String, BigDecimal> previousRegimeSignals =
        signalRepository.findByTypeAndDate(SignalType.MACRO_REGIME, previousSignalDate);
    BigDecimal previousRegimeOrdinal =
        previousRegimeSignals.values().stream().findFirst().orElse(null);

    if (previousRegimeOrdinal != null
        && currentRegimeOrdinal.compareTo(previousRegimeOrdinal) != 0
        && !alertRepository.existsActiveAlert(RULE_MACRO_REGIME_SHIFT, null)) {

      String previousRegimeName = MacroRegime.nameForOrdinal(previousRegimeOrdinal.intValue());
      String currentRegimeName = MacroRegime.nameForOrdinal(currentRegimeOrdinal.intValue());

      alertRepository.insert(
          new Alert(
              OffsetDateTime.now(),
              null,
              RULE_MACRO_REGIME_SHIFT,
              severity,
              String.format(
                  "Macro regime shifted from %s to %s", previousRegimeName, currentRegimeName),
              String.format(
                  "{\"previousRegime\":\"%s\",\"currentRegime\":\"%s\",\"signalDate\":\"%s\"}",
                  previousRegimeName, currentRegimeName, signalDate),
              AlertStatus.ACTIVE));
      return 1;
    }
    return 0;
  }
}

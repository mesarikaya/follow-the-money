package com.ftm.app.macro.service;

import com.ftm.app.signals.domain.MacroRegime;
import com.ftm.app.signals.domain.MacroThresholds;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;

/**
 * Stateless classifier implementing D-008 macro regime rules. Evaluated in priority order; first
 * matching condition wins.
 *
 * <p>Priority 1: T10Y2Y > 0.3 AND breakeven_inflation > 2.5 → STAGFLATION Priority 2: VIX > 25 OR
 * T10Y2Y < -0.2 → RISK_OFF_FLIGHT Priority 3: T10Y2Y < 0.3 AND VIX < 22 → RISK_ON_DEFENSIVE
 * Priority 4: T10Y2Y > 0.3 AND VIX < 22 → RISK_ON_GROWTH Fallback: conflicting / missing →
 * RISK_ON_GROWTH
 */
@Component
public class MacroRegimeClassifier {

  private final MacroThresholds macroThresholds;

  public MacroRegimeClassifier() {
    this.macroThresholds = MacroThresholds.defaultValues();
  }

  public MacroRegime classify(BigDecimal t10y2y, BigDecimal vix, BigDecimal breakEvenInflation) {

    if (isStagflation(t10y2y, breakEvenInflation)) {
      return MacroRegime.STAGFLATION;
    }

    if (isRiskOff(t10y2y, vix)) {
      return MacroRegime.RISK_OFF_FLIGHT;
    }

    if (isRiskOnDefensive(t10y2y, vix)) {
      return MacroRegime.RISK_ON_DEFENSIVE;
    }

    return MacroRegime.RISK_ON_GROWTH;
  }

  private boolean isStagflation(BigDecimal t10y2y, BigDecimal breakeven) {
    return greaterThan(t10y2y, macroThresholds.t10y2ySteep())
        && greaterThan(breakeven, macroThresholds.breakevenHigh());
  }

  private boolean isRiskOff(BigDecimal t10y2y, BigDecimal vix) {
    return greaterThan(vix, macroThresholds.vixStress())
        || lessThan(t10y2y, macroThresholds.t10y2yInverted());
  }

  private boolean isRiskOnDefensive(BigDecimal t10y2y, BigDecimal vix) {
    return lessThan(t10y2y, macroThresholds.t10y2ySteep())
        && lessThan(vix, macroThresholds.vixCalm());
  }

  private boolean greaterThan(BigDecimal v, BigDecimal t) {
    return v != null && v.compareTo(t) > 0;
  }

  private boolean lessThan(BigDecimal v, BigDecimal t) {
    return v != null && v.compareTo(t) < 0;
  }
}

package com.ftm.app.signals.domain;

import java.math.BigDecimal;

/**
 * Stateless classifier implementing D-008 macro regime rules. Evaluated in priority order; first
 * matching condition wins.
 *
 * <p>Priority 1: T10Y2Y > 0.3 AND breakeven_inflation > 2.5 → STAGFLATION Priority 2: VIX > 25 OR
 * T10Y2Y < -0.2 → RISK_OFF_FLIGHT Priority 3: T10Y2Y < 0.3 AND VIX < 22 → RISK_ON_DEFENSIVE
 * Priority 4: T10Y2Y > 0.3 AND VIX < 22 → RISK_ON_GROWTH Fallback: conflicting / missing →
 * RISK_ON_GROWTH
 */
public record MacroThresholds(
    BigDecimal t10y2ySteep,
    BigDecimal t10y2yInverted,
    BigDecimal vixStress,
    BigDecimal vixCalm,
    BigDecimal breakevenHigh) {
  public static MacroThresholds defaultValues() {
    return new MacroThresholds(
        new BigDecimal("0.3"), // T10Y2Y_STEEP
        new BigDecimal("-0.2"), // T10Y2Y_INVERTED
        new BigDecimal("25"), // VIX_STRESS
        new BigDecimal("22"), // VIX_CALM
        new BigDecimal("2.5") // BREAKEVEN_HIGH
        );
  }
}

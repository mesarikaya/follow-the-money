package com.ftm.app.signals.service;

import java.math.BigDecimal;

/**
 * Derives a per-category trade signal from 12-1 momentum, reflecting the validated top-N rotation
 * strategy: hold the strongest positive-momentum sectors, avoid falling ones.
 *
 * <ul>
 *   <li><b>BUY</b> — selected (among the top-N by momentum, with positive momentum): the strategy
 *       wants this sector.
 *   <li><b>HOLD</b> — positive momentum but outside the top-N: acceptable to keep, not a fresh buy.
 *   <li><b>REDUCE</b> — negative 12-1 momentum: the absolute-momentum exit (a falling sector is not
 *       held regardless of its rank).
 * </ul>
 *
 * <p>Rank-based rather than threshold-based on purpose: momentum's edge in the backtest came from
 * <em>ordering</em> sectors, not from any absolute cutoff.
 */
public final class MomentumTradeSignalDeriver {

  private MomentumTradeSignalDeriver() {}

  /**
   * @param momentum the category's 12-1 momentum (a return, e.g. 0.14 = +14%); null when unavailable
   * @param selected whether the category is in the top-N momentum selection (and thus a target)
   * @return "BUY", "HOLD", or "REDUCE"; null when momentum is unavailable
   */
  public static String derive(BigDecimal momentum, boolean selected) {
    if (momentum == null) return null;
    if (momentum.signum() < 0) return "REDUCE";
    return selected ? "BUY" : "HOLD";
  }
}

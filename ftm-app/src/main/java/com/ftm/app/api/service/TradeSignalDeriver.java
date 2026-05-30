package com.ftm.app.api.service;

import java.math.BigDecimal;

/** Derives a three-level trade signal from composite score, RRG quadrant, and 20-day trend. */
public final class TradeSignalDeriver {

  private static final BigDecimal BUY_THRESHOLD = new BigDecimal("0.65");
  private static final BigDecimal WATCH_THRESHOLD = new BigDecimal("0.50");
  private static final BigDecimal REDUCE_THRESHOLD = new BigDecimal("0.35");

  private TradeSignalDeriver() {}

  /**
   * Returns "BUY", "WATCH", "HOLD", or "REDUCE"; null when score is unavailable. Mirrors the
   * deriveTradeSignal() logic in ftm-frontend/src/lib/signals.ts.
   */
  public static String derive(BigDecimal score, String rrgQuadrant, BigDecimal trend20d) {
    if (score == null) return null;

    int quadrant = rrgQuadrant != null ? Integer.parseInt(rrgQuadrant) : 0;
    boolean improving = quadrant == 3 || quadrant == 4;
    boolean weakening = quadrant == 1 || quadrant == 2;
    boolean trending = trend20d != null && trend20d.compareTo(BigDecimal.ZERO) > 0;

    if (score.compareTo(BUY_THRESHOLD) >= 0 && improving && trending) return "BUY";
    if (score.compareTo(WATCH_THRESHOLD) >= 0 && (improving || trending)) return "WATCH";
    if (score.compareTo(REDUCE_THRESHOLD) < 0 && weakening) return "REDUCE";
    return "HOLD";
  }
}

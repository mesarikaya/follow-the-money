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

  /**
   * Conviction score 0–100: a multi-factor quality rating that combines signal clarity, macro
   * alignment, historical percentile standing, momentum direction, and institutional flow
   * confirmation. Higher scores indicate more actionable setups. Returns 0 for HOLD or missing data.
   *
   * <p>Formula components (max 100):
   * <ul>
   *   <li>Signal quality: BUY=30, REDUCE=25, near-BUY WATCH=15
   *   <li>Score level: ≥0.80→20, ≥0.65→15, ≥0.50→8
   *   <li>Macro fit: ≥0.75→18, ≥0.55→12, ≥0.35→5
   *   <li>252d percentile: ≥0.85→15, ≥0.70→10, ≥0.50→5
   *   <li>5d vs 20d acceleration: aligned→12, neutral→4
   *   <li>RS short vs long acceleration: aligned→5
   *   <li>Flow 20d z-score confirmation: aligned &gt;1.5→5 (e.g. BUY + strong inflows)
   * </ul>
   */
  public static int convictionScore(
      BigDecimal score,
      String rrgQuadrant,
      BigDecimal trend20d,
      BigDecimal macroFit,
      BigDecimal scorePercentile,
      BigDecimal trend5d,
      BigDecimal rs60,
      BigDecimal rs120,
      BigDecimal flow20d) {
    if (score == null) return 0;
    String signal = derive(score, rrgQuadrant, trend20d);
    if (signal == null || "HOLD".equals(signal)) return 0;

    int points = 0;

    if ("BUY".equals(signal)) {
      points += 30;
    } else if ("REDUCE".equals(signal)) {
      points += 25;
    } else {
      // Only near-BUY WATCH (2 of 3 conditions) earns credit
      if (countBuyConditions(score, rrgQuadrant, trend20d) < 2) return 0;
      points += 15;
    }

    double scoreD = score.doubleValue();
    if (scoreD >= 0.80) points += 20;
    else if (scoreD >= 0.65) points += 15;
    else if (scoreD >= 0.50) points += 8;

    if (macroFit != null) {
      double fit = macroFit.doubleValue();
      if (fit >= 0.75) points += 18;
      else if (fit >= 0.55) points += 12;
      else if (fit >= 0.35) points += 5;
    }

    if (scorePercentile != null) {
      double pct = scorePercentile.doubleValue();
      if (pct >= 0.85) points += 15;
      else if (pct >= 0.70) points += 10;
      else if (pct >= 0.50) points += 5;
    }

    if (trend5d != null && trend20d != null) {
      double accel = trend5d.doubleValue() - trend20d.doubleValue();
      if ("BUY".equals(signal) && accel >= 0.02) points += 12;
      else if ("REDUCE".equals(signal) && accel <= -0.02) points += 12;
      else points += 4;
    }

    if (rs60 != null && rs120 != null) {
      double rsAccel = rs60.doubleValue() - rs120.doubleValue();
      if ("BUY".equals(signal) && rsAccel > 0.003) points += 5;
      else if ("REDUCE".equals(signal) && rsAccel < -0.003) points += 5;
    }

    // Institutional flow confirmation: z-score > 1.5 on BUY = strong inflows; < -1.5 on REDUCE = outflows
    if (flow20d != null) {
      double flowZ = flow20d.doubleValue();
      if ("BUY".equals(signal) && flowZ > 1.5) points += 5;
      else if ("REDUCE".equals(signal) && flowZ < -1.5) points += 5;
    }

    return Math.min(points, 100);
  }

  private static int countBuyConditions(BigDecimal score, String rrgQuadrant, BigDecimal trend20d) {
    int count = 0;
    if (score != null && score.compareTo(BUY_THRESHOLD) >= 0) count++;
    int quadrant = rrgQuadrant != null ? Integer.parseInt(rrgQuadrant) : 0;
    if (quadrant == 3 || quadrant == 4) count++;
    if (trend20d != null && trend20d.compareTo(BigDecimal.ZERO) > 0) count++;
    return count;
  }
}

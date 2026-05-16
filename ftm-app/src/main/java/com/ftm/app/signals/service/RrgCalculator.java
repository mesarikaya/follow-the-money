package com.ftm.app.signals.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Computes RRG (Relative Rotation Graph) signals from an RS_20 series.
 *
 * RS_Ratio(t)    = 100 + EMA(RS_20, 10)(t) × 100
 * RS_Momentum(t) = 100 + (RS_Ratio(t) - EMA(RS_Ratio, 5)(t)) × 20
 *
 * Quadrant encoding: Leading=4, Improving=3, Weakening=2, Lagging=1
 */
@Component
public class RrgCalculator {

    private static final MathContext MC = new MathContext(10, RoundingMode.HALF_UP);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWENTY = BigDecimal.valueOf(20);

    public List<BigDecimal> computeRatioSeries(List<BigDecimal> rsSeries, int emaPeriod) {
        return computeEma(rsSeries, emaPeriod).stream()
                .map(v -> v == null ? null
                        : HUNDRED.add(v.multiply(HUNDRED, MC)).setScale(6, RoundingMode.HALF_UP))
                .toList();
    }

    public List<BigDecimal> computeMomentumSeries(List<BigDecimal> ratioSeries, int emaPeriod) {
        List<BigDecimal> emaOfRatio = computeEma(ratioSeries, emaPeriod);
        List<BigDecimal> result = new ArrayList<>(ratioSeries.size());
        for (int i = 0; i < ratioSeries.size(); i++) {
            BigDecimal ratio = ratioSeries.get(i);
            BigDecimal emaVal = emaOfRatio.get(i);
            if (ratio == null || emaVal == null) {
                result.add(null);
            } else {
                result.add(HUNDRED.add(ratio.subtract(emaVal, MC).multiply(TWENTY, MC))
                        .setScale(6, RoundingMode.HALF_UP));
            }
        }
        return Collections.unmodifiableList(result);
    }

    public int computeQuadrant(BigDecimal ratio, BigDecimal momentum) {
        boolean ratioAbove = ratio.compareTo(HUNDRED) > 0;
        boolean momAbove   = momentum.compareTo(HUNDRED) > 0;
        if (ratioAbove && momAbove)   return 4; // Leading
        if (!ratioAbove && momAbove)  return 3; // Improving
        if (ratioAbove && !momAbove)  return 2; // Weakening
        return 1;                                // Lagging
    }

    List<BigDecimal> computeEma(List<BigDecimal> series, int period) {
        if (series.size() < period) return Collections.nCopies(series.size(), null);

        BigDecimal alpha         = BigDecimal.valueOf(2.0 / (period + 1));
        BigDecimal oneMinusAlpha = BigDecimal.ONE.subtract(alpha, MC);

        List<BigDecimal> result = new ArrayList<>(series.size());
        for (int i = 0; i < period - 1; i++) result.add(null);

        BigDecimal sum = BigDecimal.ZERO;
        for (int i = 0; i < period; i++) {
            BigDecimal v = series.get(i);
            if (v == null) return Collections.nCopies(series.size(), null);
            sum = sum.add(v);
        }
        BigDecimal ema = sum.divide(BigDecimal.valueOf(period), MC);
        result.add(ema.setScale(6, RoundingMode.HALF_UP));

        for (int i = period; i < series.size(); i++) {
            BigDecimal v = series.get(i);
            if (v == null) {
                result.add(null);
            } else {
                ema = alpha.multiply(v, MC).add(oneMinusAlpha.multiply(ema, MC));
                result.add(ema.setScale(6, RoundingMode.HALF_UP));
            }
        }
        return Collections.unmodifiableList(result);
    }
}

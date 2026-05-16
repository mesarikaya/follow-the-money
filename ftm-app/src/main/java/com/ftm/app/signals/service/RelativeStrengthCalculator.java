package com.ftm.app.signals.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Computes RS_N = (category[last] / category[last-N]) / (benchmark[last] / benchmark[last-N]).
 * Prices must be in ascending chronological order (oldest first).
 * Returns null if the series does not have enough data.
 */
@Component
public class RelativeStrengthCalculator {

    private static final MathContext MC = new MathContext(10, RoundingMode.HALF_UP);

    public BigDecimal computeRs(List<BigDecimal> catPrices, List<BigDecimal> benchPrices, int windowDays) {
        int need = windowDays + 1;
        if (catPrices.size() < need || benchPrices.size() < need) return null;

        int last = catPrices.size() - 1;
        int prev = last - windowDays;
        if (prev < 0 || prev >= benchPrices.size() || last >= benchPrices.size()) return null;

        BigDecimal catToday = catPrices.get(last);
        BigDecimal catBase  = catPrices.get(prev);
        BigDecimal bnchToday = benchPrices.get(last);
        BigDecimal bnchBase  = benchPrices.get(prev);

        if (catBase.compareTo(BigDecimal.ZERO) == 0 || bnchBase.compareTo(BigDecimal.ZERO) == 0
                || bnchToday.compareTo(BigDecimal.ZERO) == 0) return null;

        BigDecimal catReturn   = catToday.divide(catBase, MC);
        BigDecimal benchReturn = bnchToday.divide(bnchBase, MC);
        // RS = ratio - 1 so neutral = 0 (spec formula; required for RRG centering at 100)
        return catReturn.divide(benchReturn, MC).subtract(BigDecimal.ONE).setScale(6, RoundingMode.HALF_UP);
    }

    /**
     * Computes the full RS series for every position t in [windowDays, minSize).
     * Each element = RS(t) using a look-back of windowDays. Null when a price is zero.
     * Prices must be in ascending chronological order (oldest first).
     */
    public List<BigDecimal> computeRsSeries(List<BigDecimal> catPrices, List<BigDecimal> benchPrices, int windowDays) {
        int minSize = Math.min(catPrices.size(), benchPrices.size());
        if (minSize <= windowDays) return List.of();

        List<BigDecimal> series = new ArrayList<>(minSize - windowDays);
        for (int t = windowDays; t < minSize; t++) {
            BigDecimal catToday  = catPrices.get(t);
            BigDecimal catBase   = catPrices.get(t - windowDays);
            BigDecimal bnchToday = benchPrices.get(t);
            BigDecimal bnchBase  = benchPrices.get(t - windowDays);

            if (catBase.compareTo(BigDecimal.ZERO) == 0
                    || bnchBase.compareTo(BigDecimal.ZERO) == 0
                    || bnchToday.compareTo(BigDecimal.ZERO) == 0) {
                series.add(null);
            } else {
                BigDecimal catReturn   = catToday.divide(catBase, MC);
                BigDecimal benchReturn = bnchToday.divide(bnchBase, MC);
                series.add(catReturn.divide(benchReturn, MC)
                        .subtract(BigDecimal.ONE)
                        .setScale(6, RoundingMode.HALF_UP));
            }
        }
        return Collections.unmodifiableList(series);
    }

    /**
     * Computes MOM = RS_60 at position [last] minus RS_60 at position [last - lag].
     * Prices must be in ascending chronological order.
     */
    public BigDecimal computeMom(List<BigDecimal> catPrices, List<BigDecimal> benchPrices, int lag) {
        int rs60Window = 60;
        int need = rs60Window + lag + 1;
        if (catPrices.size() < need || benchPrices.size() < need) return null;

        // RS_60 anchored at "today" (last element)
        BigDecimal rs60Today = computeRs(catPrices, benchPrices, rs60Window);
        if (rs60Today == null) return null;

        // RS_60 anchored at lag trading days ago (trim the last 'lag' elements)
        List<BigDecimal> catLagged   = catPrices.subList(0, catPrices.size() - lag);
        List<BigDecimal> benchLagged = benchPrices.subList(0, benchPrices.size() - lag);
        BigDecimal rs60Lagged = computeRs(catLagged, benchLagged, rs60Window);
        if (rs60Lagged == null) return null;

        return rs60Today.subtract(rs60Lagged).setScale(6, RoundingMode.HALF_UP);
    }
}

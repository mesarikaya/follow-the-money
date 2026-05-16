package com.ftm.app.signals.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class RelativeStrengthCalculatorRrsSeriesTest {

    private final RelativeStrengthCalculator calc = new RelativeStrengthCalculator();

    @Test
    @DisplayName("computeRsSeries returns empty list when series too short for window")
    void shouldReturnEmptyWhenTooShort() {
        List<BigDecimal> prices = Collections.nCopies(10, bd(100));
        assertThat(calc.computeRsSeries(prices, prices, 20)).isEmpty();
    }

    @Test
    @DisplayName("computeRsSeries returns list of length (size - windowDays)")
    void shouldReturnCorrectLength() {
        List<BigDecimal> prices = Collections.nCopies(30, bd(100));
        assertThat(calc.computeRsSeries(prices, prices, 20)).hasSize(10);
    }

    @Test
    @DisplayName("computeRsSeries returns 0.0 at each position when cat and bench move equally")
    void shouldReturnZeroWhenEqualPerformance() {
        List<BigDecimal> cat   = series(100, 30, 0.0);
        List<BigDecimal> bench = series(200, 30, 0.0);

        List<BigDecimal> rs = calc.computeRsSeries(cat, bench, 20);

        assertThat(rs).isNotEmpty().allSatisfy(v ->
                assertThat(v.doubleValue()).isCloseTo(0.0, within(0.0001)));
    }

    @Test
    @DisplayName("computeRsSeries returns positive values when category consistently outperforms")
    void shouldReturnPositiveWhenCategoryOutperforms() {
        // cat grows +20% over the window, bench stays flat
        List<BigDecimal> cat   = series(100, 30, 0.01);  // each step +1%
        List<BigDecimal> bench = Collections.nCopies(30, bd(200));

        List<BigDecimal> rs = calc.computeRsSeries(cat, bench, 20);

        assertThat(rs).isNotEmpty().allSatisfy(v ->
                assertThat(v.doubleValue()).isGreaterThan(0.0));
    }

    @Test
    @DisplayName("computeRsSeries returns null at positions where base price is zero")
    void shouldReturnNullWhenBasePriceZero() {
        List<BigDecimal> cat   = new java.util.ArrayList<>();
        cat.add(bd(0));  // base at t=0
        for (int i = 1; i < 25; i++) cat.add(bd(100));

        List<BigDecimal> bench = Collections.nCopies(25, bd(200));

        List<BigDecimal> rs = calc.computeRsSeries(cat, bench, 20);

        // First element uses cat[0] as base → null
        assertThat(rs.get(0)).isNull();
        // Later elements are fine
        assertThat(rs.get(rs.size() - 1)).isNotNull();
    }

    private static List<BigDecimal> series(double start, int count, double stepPct) {
        List<BigDecimal> list = new java.util.ArrayList<>();
        double v = start;
        for (int i = 0; i < count; i++) {
            list.add(BigDecimal.valueOf(v));
            v *= (1 + stepPct);
        }
        return list;
    }

    private static BigDecimal bd(double val) {
        return BigDecimal.valueOf(val);
    }
}

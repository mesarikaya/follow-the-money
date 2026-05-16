package com.ftm.app.signals.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class RelativeStrengthCalculatorTest {

    private final RelativeStrengthCalculator calc = new RelativeStrengthCalculator();

    @Test
    @DisplayName("computeRs returns expected ratio when category outperforms benchmark")
    void shouldReturnRsWhenCategoryOutperformsBenchmark() {
        // category +10%, benchmark +5% over 20 days => ratio ≈ 1.0476 → RS = 0.0476
        List<BigDecimal> cat   = series(100.0, 20, 110.0);
        List<BigDecimal> bench = series(200.0, 20, 210.0);

        BigDecimal rs = calc.computeRs(cat, bench, 20);

        assertThat(rs).isNotNull();
        assertThat(rs.doubleValue()).isCloseTo(0.0476, within(0.001));
    }

    @Test
    @DisplayName("computeRs returns null when series too short")
    void shouldReturnNullWhenSeriesTooShort() {
        List<BigDecimal> cat   = List.of(bd(100), bd(105));
        List<BigDecimal> bench = List.of(bd(200), bd(205));

        assertThat(calc.computeRs(cat, bench, 20)).isNull();
    }

    @Test
    @DisplayName("computeRs returns null when base price is zero")
    void shouldReturnNullWhenBasePriceIsZero() {
        List<BigDecimal> cat   = series(0.0, 20, 100.0);
        List<BigDecimal> bench = series(100.0, 20, 110.0);

        assertThat(calc.computeRs(cat, bench, 20)).isNull();
    }

    @Test
    @DisplayName("computeRs returns 0.0 when both move equally")
    void shouldReturnZeroWhenEqualPerformance() {
        List<BigDecimal> cat   = series(100.0, 20, 110.0);
        List<BigDecimal> bench = series(200.0, 20, 220.0);

        BigDecimal rs = calc.computeRs(cat, bench, 20);

        assertThat(rs).isNotNull();
        assertThat(rs.doubleValue()).isCloseTo(0.0, within(0.0001));
    }

    @Test
    @DisplayName("computeMom returns difference between RS_60 today and RS_60 10d ago")
    void shouldComputeMomAsRs60Difference() {
        // 130 prices for cat (all same) and bench (all same) → RS always 1.0 → MOM = 0
        List<BigDecimal> cat   = Collections.nCopies(130, bd(100));
        List<BigDecimal> bench = Collections.nCopies(130, bd(200));

        BigDecimal mom = calc.computeMom(cat, bench, 10);

        assertThat(mom).isNotNull();
        assertThat(mom.doubleValue()).isCloseTo(0.0, within(0.000001));
    }

    @Test
    @DisplayName("computeMom returns null when series too short for MOM lag")
    void shouldReturnNullWhenTooShortForMom() {
        List<BigDecimal> prices = Collections.nCopies(70, bd(100));

        assertThat(calc.computeMom(prices, prices, 10)).isNull();
    }

    private static List<BigDecimal> series(double start, int middleCount, double end) {
        List<BigDecimal> list = new ArrayList<>();
        list.add(bd(start));
        for (int i = 0; i < middleCount - 1; i++) list.add(bd(start + i));
        list.add(bd(end));
        return list;
    }

    private static BigDecimal bd(double val) {
        return BigDecimal.valueOf(val);
    }
}

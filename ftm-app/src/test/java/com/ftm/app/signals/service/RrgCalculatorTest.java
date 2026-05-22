package com.ftm.app.signals.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RrgCalculatorTest {

  private final RrgCalculator calc = new RrgCalculator();

  // ── computeEma ────────────────────────────────────────────────────────

  @Test
  @DisplayName("computeEma returns all nulls when series shorter than period")
  void emaShouldReturnAllNullsWhenTooShort() {
    List<BigDecimal> series = Collections.nCopies(5, bd(1));
    assertThat(calc.computeEma(series, 10)).containsOnlyNulls();
  }

  @Test
  @DisplayName("computeEma first (period-1) entries are null, rest are non-null")
  void emaShouldHaveLeadingNulls() {
    List<BigDecimal> series = Collections.nCopies(15, bd(100));
    List<BigDecimal> ema = calc.computeEma(series, 5);

    assertThat(ema).hasSize(15);
    assertThat(ema.subList(0, 4)).containsOnlyNulls();
    assertThat(ema.subList(4, 15)).doesNotContainNull();
  }

  @Test
  @DisplayName("computeEma converges to constant series value")
  void emaShouldConvergeToConstant() {
    List<BigDecimal> series = Collections.nCopies(50, bd(42));
    List<BigDecimal> ema = calc.computeEma(series, 10);

    BigDecimal last = ema.getLast();
    assertThat(last).isNotNull();
    assertThat(last.doubleValue()).isCloseTo(42.0, within(0.001));
  }

  @Test
  @DisplayName("computeEma skips leading nulls and seeds from first non-null run")
  void emaShouldSkipLeadingNulls() {
    List<BigDecimal> series = new java.util.ArrayList<>();
    for (int i = 0; i < 9; i++) series.add(null);
    for (int i = 0; i < 10; i++) series.add(bd(100)); // 10 non-null values after 9 nulls

    List<BigDecimal> ema = calc.computeEma(series, 5);

    assertThat(ema).hasSize(19);
    assertThat(ema.subList(0, 13)).containsOnlyNulls(); // 9 leading + 4 more = 13
    assertThat(ema.get(13)).isNotNull();
    assertThat(ema.getLast()).isNotNull();
  }

  // ── computeRatioSeries ────────────────────────────────────────────────

  @Test
  @DisplayName("computeRatioSeries returns 100 when RS series is all zeros")
  void ratioShouldBe100WhenRsIsZero() {
    List<BigDecimal> rs = Collections.nCopies(20, bd(0));
    List<BigDecimal> ratio = calc.computeRatioSeries(rs, 10);

    BigDecimal last = ratio.getLast();
    assertThat(last).isNotNull();
    assertThat(last.doubleValue()).isCloseTo(100.0, within(0.001));
  }

  @Test
  @DisplayName("computeRatioSeries returns > 100 when RS series is consistently positive")
  void ratioShouldExceed100ForPositiveRs() {
    List<BigDecimal> rs = Collections.nCopies(20, bd(0.05)); // RS = +5%
    List<BigDecimal> ratio = calc.computeRatioSeries(rs, 10);

    BigDecimal last = ratio.getLast();
    assertThat(last).isNotNull();
    assertThat(last.doubleValue()).isGreaterThan(100.0);
  }

  @Test
  @DisplayName("computeRatioSeries length equals input series length")
  void ratioLengthMatchesInput() {
    List<BigDecimal> rs = Collections.nCopies(30, bd(0.01));
    assertThat(calc.computeRatioSeries(rs, 10)).hasSize(30);
  }

  // ── computeMomentumSeries ─────────────────────────────────────────────

  @Test
  @DisplayName("computeMomentumSeries returns 100 when ratio is flat at 100")
  void momentumShouldBe100WhenRatioFlat() {
    List<BigDecimal> ratio = Collections.nCopies(20, bd(100));
    List<BigDecimal> mom = calc.computeMomentumSeries(ratio, 5);

    BigDecimal last = mom.getLast();
    assertThat(last).isNotNull();
    assertThat(last.doubleValue()).isCloseTo(100.0, within(0.001));
  }

  @Test
  @DisplayName("computeMomentumSeries returns > 100 when ratio is rising")
  void momentumShouldExceed100WhenRatioRising() {
    List<BigDecimal> ratio = new java.util.ArrayList<>();
    double v = 99.0;
    for (int i = 0; i < 20; i++) {
      ratio.add(bd(v));
      v += 0.5;
    }

    List<BigDecimal> mom = calc.computeMomentumSeries(ratio, 5);

    BigDecimal last = mom.getLast();
    assertThat(last).isNotNull();
    assertThat(last.doubleValue()).isGreaterThan(100.0);
  }

  // ── computeQuadrant ───────────────────────────────────────────────────

  @Test
  @DisplayName("computeQuadrant returns 4 (Leading) when ratio>100 and mom>100")
  void shouldReturnLeading() {
    assertThat(calc.computeQuadrant(bd(102), bd(103))).isEqualTo(4);
  }

  @Test
  @DisplayName("computeQuadrant returns 3 (Improving) when ratio<100 and mom>100")
  void shouldReturnImproving() {
    assertThat(calc.computeQuadrant(bd(98), bd(101))).isEqualTo(3);
  }

  @Test
  @DisplayName("computeQuadrant returns 2 (Weakening) when ratio>100 and mom<100")
  void shouldReturnWeakening() {
    assertThat(calc.computeQuadrant(bd(101), bd(99))).isEqualTo(2);
  }

  @Test
  @DisplayName("computeQuadrant returns 1 (Lagging) when ratio<100 and mom<100")
  void shouldReturnLagging() {
    assertThat(calc.computeQuadrant(bd(97), bd(98))).isEqualTo(1);
  }

  private static BigDecimal bd(double val) {
    return BigDecimal.valueOf(val);
  }
}

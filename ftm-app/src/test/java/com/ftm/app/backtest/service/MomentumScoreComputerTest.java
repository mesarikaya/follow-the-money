package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MomentumScoreComputerTest {

  private final MomentumScoreComputer computer = new MomentumScoreComputer();

  /** Ascending price history: index 0..5 = 2020-01-01..2020-01-06 (treated as trading days). */
  private static NavigableMap<LocalDate, Map<String, BigDecimal>> priceHistory() {
    NavigableMap<LocalDate, Map<String, BigDecimal>> prices = new TreeMap<>();
    prices.put(LocalDate.of(2020, 1, 1), Map.of("TECH", bd(100), "HLTH", bd(50)));
    prices.put(LocalDate.of(2020, 1, 2), Map.of("TECH", bd(110), "HLTH", bd(52)));
    prices.put(LocalDate.of(2020, 1, 3), Map.of("TECH", bd(120), "HLTH", bd(51)));
    prices.put(LocalDate.of(2020, 1, 4), Map.of("TECH", bd(150), "HLTH", bd(55)));
    prices.put(LocalDate.of(2020, 1, 5), Map.of("TECH", bd(160), "HLTH", bd(54)));
    prices.put(LocalDate.of(2020, 1, 6), Map.of("TECH", bd(180), "HLTH", bd(58)));
    return prices;
  }

  private static BigDecimal bd(double v) {
    return BigDecimal.valueOf(v);
  }

  @Test
  @DisplayName("computes recent/past - 1 with the skip window, per category")
  void computesSkippedMomentum() {
    // scoreDate index 5 (2020-01-06), lookback 4, skip 1:
    //   recent = index 5-1 = 4 (2020-01-05), past = index 5-4 = 1 (2020-01-02).
    //   TECH = 160/110 - 1 = 0.454545 ; HLTH = 54/52 - 1 = 0.038462.
    Map<LocalDate, Map<String, BigDecimal>> scores =
        computer.computeMomentumScores(List.of(LocalDate.of(2020, 1, 6)), priceHistory(), 4, 1);

    Map<String, BigDecimal> byCategory = scores.get(LocalDate.of(2020, 1, 6));
    assertThat(byCategory).isNotNull();
    assertThat(byCategory.get("TECH").doubleValue()).isCloseTo(0.454545, within(1e-5));
    assertThat(byCategory.get("HLTH").doubleValue()).isCloseTo(0.038462, within(1e-5));
  }

  @Test
  @DisplayName("skips score dates without enough leading history")
  void skipsInsufficientHistory() {
    // idx 3 < lookback 4 → no score; idx 4 == lookback 4 → scored.
    Map<LocalDate, Map<String, BigDecimal>> scores =
        computer.computeMomentumScores(
            List.of(LocalDate.of(2020, 1, 4), LocalDate.of(2020, 1, 5)), priceHistory(), 4, 1);

    assertThat(scores).doesNotContainKey(LocalDate.of(2020, 1, 4));
    assertThat(scores).containsKey(LocalDate.of(2020, 1, 5));
  }

  @Test
  @DisplayName("returns empty for empty or null price history")
  void handlesEmptyHistory() {
    assertThat(computer.computeMomentumScores(List.of(LocalDate.of(2020, 1, 6)), new TreeMap<>(), 4, 1))
        .isEmpty();
    assertThat(computer.computeMomentumScores(List.of(LocalDate.of(2020, 1, 6)), null, 4, 1))
        .isEmpty();
  }

  @Test
  @DisplayName("ignores categories with a non-positive or missing past price")
  void ignoresBadPastPrices() {
    NavigableMap<LocalDate, Map<String, BigDecimal>> prices = new TreeMap<>();
    prices.put(LocalDate.of(2020, 1, 1), Map.of("ZERO", bd(0), "OK", bd(10)));
    prices.put(LocalDate.of(2020, 1, 2), Map.of("ZERO", bd(5), "OK", bd(11)));
    prices.put(LocalDate.of(2020, 1, 3), Map.of("ZERO", bd(6), "OK", bd(12), "NEW", bd(20)));

    Map<LocalDate, Map<String, BigDecimal>> scores =
        computer.computeMomentumScores(List.of(LocalDate.of(2020, 1, 3)), prices, 2, 0);

    Map<String, BigDecimal> byCategory = scores.get(LocalDate.of(2020, 1, 3));
    assertThat(byCategory).containsOnlyKeys("OK"); // ZERO past=0 excluded; NEW has no past price
    assertThat(byCategory.get("OK").doubleValue()).isCloseTo(0.2, within(1e-9)); // 12/10 - 1
  }
}

package com.ftm.app.backtest.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.NavigableMap;
import java.util.TreeMap;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MarketRegimeFilterTest {

  private final MarketRegimeFilter filter = new MarketRegimeFilter();

  // Prices: 5 rising days then one value; MA over 5 days.
  private NavigableMap<LocalDate, BigDecimal> series(double... prices) {
    NavigableMap<LocalDate, BigDecimal> map = new TreeMap<>();
    LocalDate d = LocalDate.of(2023, 1, 2);
    for (double p : prices) {
      map.put(d, BigDecimal.valueOf(p));
      d = d.plusDays(1);
    }
    return map;
  }

  @Test
  @DisplayName("risk-on when price is above the trailing moving average")
  void riskOnAboveMovingAverage() {
    // last 5: 100,101,102,103,110 → MA=103.2; price 110 ≥ MA → risk-on
    var prices = series(100, 101, 102, 103, 110);
    assertThat(filter.isRiskOn(LocalDate.of(2023, 1, 6), prices, 5)).isTrue();
  }

  @Test
  @DisplayName("risk-off when price is below the trailing moving average")
  void riskOffBelowMovingAverage() {
    // last 5: 110,108,106,104,90 → MA=103.6; price 90 < MA → risk-off
    var prices = series(110, 108, 106, 104, 90);
    assertThat(filter.isRiskOn(LocalDate.of(2023, 1, 6), prices, 5)).isFalse();
  }

  @Test
  @DisplayName("defaults to risk-on when there is not enough history to form the average")
  void riskOnWhenInsufficientHistory() {
    var prices = series(100, 90, 80); // only 3 points, window 5 → insufficient
    assertThat(filter.isRiskOn(LocalDate.of(2023, 1, 4), prices, 5)).isTrue();
  }

  @Test
  @DisplayName("evaluates against the price at or before the given date, ignoring future prices")
  void usesPriceAtOrBeforeDate() {
    // Evaluate on day 4 (price 104); MA of first 4 = (100+102+104+... wait) → use 3-day window.
    var prices = series(100, 102, 104, 60, 60); // days 1..5
    // On day 3 (104), 3-day MA = (100+102+104)/3 = 102 → 104 ≥ 102 → risk-on; future crash ignored.
    assertThat(filter.isRiskOn(LocalDate.of(2023, 1, 4), prices, 3)).isTrue();
  }

  @Test
  @DisplayName("empty or null price history is treated as risk-on (no filtering)")
  void emptyHistoryRiskOn() {
    assertThat(filter.isRiskOn(LocalDate.of(2023, 1, 2), new TreeMap<>(), 5)).isTrue();
    assertThat(filter.isRiskOn(LocalDate.of(2023, 1, 2), null, 5)).isTrue();
  }
}

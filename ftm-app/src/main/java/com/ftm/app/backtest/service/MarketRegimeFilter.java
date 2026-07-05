package com.ftm.app.backtest.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.NavigableMap;
import org.springframework.stereotype.Component;

/**
 * Absolute-momentum (trend) filter for the dual-momentum overlay: the market is "risk-on" when the
 * benchmark's price is at or above its trailing moving average, and "risk-off" (go to cash)
 * otherwise. This is a structural risk rule — a standard long-term moving average, not a fitted
 * parameter — so it reduces drawdowns in sustained downtrends without claiming selection alpha.
 *
 * <p>Pure and stateless: the price history is passed in as a sorted map, so it has no repository
 * dependency and is directly unit-testable.
 */
@Component
public class MarketRegimeFilter {

  /**
   * @param date the rebalance date to evaluate
   * @param pricesByDate benchmark prices sorted by date (should include history before {@code
   *     date})
   * @param maWindow number of trailing observations (≤ date) that form the moving average
   * @return {@code true} (risk-on) when the price on/at-or-before {@code date} is ≥ its trailing
   *     average; {@code true} as a safe default when there is no price or not enough history to
   *     form the average (so the early backtest window is not filtered out).
   */
  public boolean isRiskOn(
      LocalDate date, NavigableMap<LocalDate, BigDecimal> pricesByDate, int maWindow) {
    if (pricesByDate == null || pricesByDate.isEmpty() || maWindow <= 0) return true;

    var priceEntry = pricesByDate.floorEntry(date);
    if (priceEntry == null) return true;
    BigDecimal priceOnDate = priceEntry.getValue();

    NavigableMap<LocalDate, BigDecimal> history = pricesByDate.headMap(date, true);
    if (history.size() < maWindow) return true; // insufficient history — do not filter

    List<BigDecimal> lastWindow =
        history.descendingMap().values().stream().limit(maWindow).toList();
    BigDecimal sum = lastWindow.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    BigDecimal movingAverage =
        sum.divide(BigDecimal.valueOf(lastWindow.size()), 6, RoundingMode.HALF_UP);

    return priceOnDate.compareTo(movingAverage) >= 0;
  }
}

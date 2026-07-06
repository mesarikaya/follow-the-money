package com.ftm.app.backtest.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import org.springframework.stereotype.Component;

/**
 * Computes classic 12-1 (Jegadeesh-Titman / Asness) momentum scores from a category price history:
 * the cumulative return from ~{@code lookback} trading days ago to ~{@code skip} trading days ago,
 * i.e. the trailing 12-month return that <em>skips the most recent month</em> to avoid the well-
 * documented short-term reversal that pollutes shorter-horizon relative strength.
 *
 * <p>Pure and stateless: the price history is passed in as a sorted date→(category→price) map, so it
 * has no repository dependency and is directly unit-testable. Output matches the {@code
 * compositesByDate} shape so it can drop into the backtest engine as an alternative signal source.
 */
@Component
public class MomentumScoreComputer {

  /**
   * @param scoreDates the dates to compute momentum scores for (e.g. rebalance dates)
   * @param pricesByDate sorted price history; must include ~{@code lookback} trading days of history
   *     before the earliest score date
   * @param lookbackTradingDays long-leg lookback (≈252 for 12 months)
   * @param skipTradingDays short-leg skip (≈21 for 1 month)
   * @return momentum score per category for each score date that has enough history (higher = stronger)
   */
  public Map<LocalDate, Map<String, BigDecimal>> computeMomentumScores(
      List<LocalDate> scoreDates,
      NavigableMap<LocalDate, Map<String, BigDecimal>> pricesByDate,
      int lookbackTradingDays,
      int skipTradingDays) {

    Map<LocalDate, Map<String, BigDecimal>> result = new HashMap<>();
    if (pricesByDate == null || pricesByDate.isEmpty()) return result;

    List<LocalDate> priceDates = new ArrayList<>(pricesByDate.keySet()); // ascending (TreeMap)

    for (LocalDate scoreDate : scoreDates) {
      int idx = floorIndex(priceDates, scoreDate);
      if (idx < lookbackTradingDays) continue; // not enough history to form the 12-month lookback

      Map<String, BigDecimal> recentPrices = pricesByDate.get(priceDates.get(idx - skipTradingDays));
      Map<String, BigDecimal> pastPrices = pricesByDate.get(priceDates.get(idx - lookbackTradingDays));
      if (recentPrices == null || pastPrices == null) continue;

      Map<String, BigDecimal> scores = new HashMap<>();
      for (Map.Entry<String, BigDecimal> entry : recentPrices.entrySet()) {
        BigDecimal recent = entry.getValue();
        BigDecimal past = pastPrices.get(entry.getKey());
        if (recent != null && past != null && past.signum() > 0) {
          scores.put(
              entry.getKey(),
              recent.divide(past, 6, RoundingMode.HALF_UP).subtract(BigDecimal.ONE));
        }
      }
      if (!scores.isEmpty()) result.put(scoreDate, scores);
    }
    return result;
  }

  /** Index of the latest price date at or before {@code target}; -1 if none. */
  private int floorIndex(List<LocalDate> sortedDates, LocalDate target) {
    int lo = 0, hi = sortedDates.size() - 1, ans = -1;
    while (lo <= hi) {
      int mid = (lo + hi) >>> 1;
      if (!sortedDates.get(mid).isAfter(target)) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }
}

package com.ftm.app.api.service;

import com.ftm.app.api.dto.ScreenerSnapshotDto;
import com.ftm.app.domain.SignalType;
import java.math.BigDecimal;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * The one-line summary of the whole screener: how the top-level categories split across the four
 * trade signals, their average score, and three breadth readings — how many are outperforming, how
 * many are accelerating, and how many sit in a risk-on rotation quadrant.
 */
@Component
public class ScreenerSnapshotCalculator {

  private static final ScreenerSnapshotDto EMPTY =
      new ScreenerSnapshotDto(0, 0, 0, 0, 0, 0.0, 0.0, 0.0, 0.0);

  private static final int RRG_IMPROVING = 3;
  private static final int RRG_LEADING = 4;

  public ScreenerSnapshotDto calculate(
      Set<String> topLevelCategoryIds, Map<SignalType, Map<String, BigDecimal>> signals) {
    if (topLevelCategoryIds.isEmpty()) return EMPTY;

    Map<String, BigDecimal> composites = latest(signals, SignalType.COMPOSITE);
    Map<String, BigDecimal> quadrants = latest(signals, SignalType.RRG_QUADRANT);
    Map<String, BigDecimal> trends20d = latest(signals, SignalType.COMPOSITE_TREND_20D);
    Map<String, BigDecimal> rs60s = latest(signals, SignalType.RS_60);
    Map<String, BigDecimal> rs20s = latest(signals, SignalType.RS_20);

    Tally tally = new Tally();
    for (String categoryId : topLevelCategoryIds) {
      BigDecimal score = composites.get(categoryId);
      if (score == null) continue;
      BigDecimal quadrant = quadrants.get(categoryId);
      tally.add(
          score,
          TradeSignalDeriver.derive(score, quadrantOf(quadrant), trends20d.get(categoryId)),
          rs60s.get(categoryId),
          rs20s.get(categoryId),
          quadrant);
    }
    return tally.toSnapshot();
  }

  private static Map<String, BigDecimal> latest(
      Map<SignalType, Map<String, BigDecimal>> signals, SignalType type) {
    return signals.getOrDefault(type, Collections.emptyMap());
  }

  private static String quadrantOf(BigDecimal quadrant) {
    return quadrant != null ? String.valueOf(quadrant.intValue()) : null;
  }

  /** Running counts over the categories that have a composite score. */
  private static final class Tally {

    private int buyCount, watchCount, holdCount, reduceCount;
    private int scoredCount;
    private double scoreSum;
    private int outperformingCount, acceleratingCount, riskOnCount;

    void add(
        BigDecimal score,
        String tradeSignal,
        BigDecimal rs60,
        BigDecimal rs20,
        BigDecimal quadrant) {
      scoredCount++;
      scoreSum += score.doubleValue();

      switch (tradeSignal != null ? tradeSignal : "HOLD") {
        case "BUY" -> buyCount++;
        case "WATCH" -> watchCount++;
        case "REDUCE" -> reduceCount++;
        default -> holdCount++;
      }

      if (rs60 != null && rs60.signum() > 0) outperformingCount++;
      if (rs60 != null && rs20 != null && rs20.compareTo(rs60) > 0) acceleratingCount++;
      if (quadrant != null
          && (quadrant.intValue() == RRG_IMPROVING || quadrant.intValue() == RRG_LEADING)) {
        riskOnCount++;
      }
    }

    ScreenerSnapshotDto toSnapshot() {
      if (scoredCount == 0) return EMPTY;
      return new ScreenerSnapshotDto(
          buyCount,
          watchCount,
          holdCount,
          reduceCount,
          scoredCount,
          Math.round(scoreSum / scoredCount * 1000.0) / 1000.0,
          percentOf(outperformingCount),
          percentOf(acceleratingCount),
          percentOf(riskOnCount));
    }

    private double percentOf(int count) {
      return Math.round((double) count / scoredCount * 1000.0) / 10.0;
    }
  }
}

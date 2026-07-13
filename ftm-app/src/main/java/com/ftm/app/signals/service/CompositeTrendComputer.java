package com.ftm.app.signals.service;

import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import com.ftm.app.signals.repository.SignalRepository.Row;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/**
 * How far each category's composite score has moved over the last 5, 10 and 20 sessions — the
 * "is this improving or decaying?" reading the whole app leans on. Derived from the composite
 * history after it has been stored, so it always reflects the scores actually written.
 */
@Component
public class CompositeTrendComputer {

  /** A lookback in sessions and the signal its trend is stored as. */
  private record Trend(int lagInSessions, SignalType signalType) {}

  private static final List<Trend> TRENDS =
      List.of(
          new Trend(5, SignalType.COMPOSITE_TREND_5D),
          new Trend(10, SignalType.COMPOSITE_TREND_10D),
          new Trend(20, SignalType.COMPOSITE_TREND_20D));

  private final SignalRepository signalRepository;

  public CompositeTrendComputer(SignalRepository signalRepository) {
    this.signalRepository = signalRepository;
  }

  /** @return how many trend signals were written */
  public int computeAndStore() {
    List<Row> composites = signalRepository.findAllByType(SignalType.COMPOSITE);
    if (composites.isEmpty()) return 0;

    List<Row> trendRows = new ArrayList<>();
    groupByCategory(composites)
        .forEach(
            (categoryId, history) ->
                TRENDS.forEach(
                    trend ->
                        trendRows.addAll(
                            trends(
                                categoryId, history, trend.lagInSessions(), trend.signalType()))));

    return trendRows.isEmpty() ? 0 : signalRepository.batchUpsert(trendRows);
  }

  private static Map<String, List<Row>> groupByCategory(List<Row> composites) {
    return composites.stream()
        .collect(Collectors.groupingBy(Row::categoryId, LinkedHashMap::new, Collectors.toList()));
  }

  /** The change in score against the value {@code lag} sessions earlier, for every day we can. */
  private static List<Row> trends(
      String categoryId, List<Row> history, int lag, SignalType trendType) {
    List<Row> trends = new ArrayList<>();
    for (int i = lag; i < history.size(); i++) {
      BigDecimal current = history.get(i).value();
      BigDecimal prior = history.get(i - lag).value();
      if (current == null || prior == null) continue;
      trends.add(
          new Row(history.get(i).signalDate(), categoryId, trendType, current.subtract(prior)));
    }
    return trends;
  }
}

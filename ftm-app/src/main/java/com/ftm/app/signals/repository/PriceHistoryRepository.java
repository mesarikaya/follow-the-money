package com.ftm.app.signals.repository;

import static com.ftm.app.jooq.Tables.BENCHMARK_PRICES;
import static com.ftm.app.jooq.Tables.RAW_PRICES;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

/**
 * The whole price history, loaded once so signal computation can walk it in memory rather than
 * querying per date and category.
 */
@Repository
public class PriceHistoryRepository {

  /** One day of a category's price, with the volume needed to derive dollar flow. */
  public record DatePrice(LocalDate date, BigDecimal price, Long volume) {}

  private final DSLContext dsl;

  public PriceHistoryRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  /** Every category's adjusted closes, oldest first, keyed by category id. */
  public Map<String, List<DatePrice>> findCategoryPricesByCategoryId() {
    return dsl
        .select(
            RAW_PRICES.CATEGORY_ID, RAW_PRICES.TRADE_DATE, RAW_PRICES.ADJ_CLOSE, RAW_PRICES.VOLUME)
        .from(RAW_PRICES)
        .orderBy(RAW_PRICES.CATEGORY_ID, RAW_PRICES.TRADE_DATE.asc())
        .fetch()
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> r.get(RAW_PRICES.CATEGORY_ID),
                Collectors.mapping(
                    r ->
                        new DatePrice(
                            r.get(RAW_PRICES.TRADE_DATE),
                            r.get(RAW_PRICES.ADJ_CLOSE),
                            r.get(RAW_PRICES.VOLUME)),
                    Collectors.toList())));
  }

  /** Every benchmark's adjusted closes, oldest first, keyed by ticker. Volume is not tracked. */
  public Map<String, List<DatePrice>> findBenchmarkPricesByTicker() {
    return dsl
        .select(BENCHMARK_PRICES.TICKER, BENCHMARK_PRICES.TRADE_DATE, BENCHMARK_PRICES.ADJ_CLOSE)
        .from(BENCHMARK_PRICES)
        .orderBy(BENCHMARK_PRICES.TICKER, BENCHMARK_PRICES.TRADE_DATE.asc())
        .fetch()
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> r.get(BENCHMARK_PRICES.TICKER),
                Collectors.mapping(
                    r ->
                        new DatePrice(
                            r.get(BENCHMARK_PRICES.TRADE_DATE),
                            r.get(BENCHMARK_PRICES.ADJ_CLOSE),
                            null),
                    Collectors.toList())));
  }
}

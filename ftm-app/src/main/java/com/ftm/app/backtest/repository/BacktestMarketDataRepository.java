package com.ftm.app.backtest.repository;

import static com.ftm.app.jooq.Tables.*;

import com.ftm.app.domain.SignalType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

/**
 * The only place the backtest talks to the database: trading days, ETF and benchmark prices,
 * composite scores, and the category universe a run is scoped to.
 */
@Repository
public class BacktestMarketDataRepository {

  private static final String BENCHMARK_TICKER = "SPY";

  private final DSLContext dsl;

  public BacktestMarketDataRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  /** Every day the benchmark traded in the range — the backtest's calendar. */
  public List<LocalDate> fetchTradingDates(LocalDate startDate, LocalDate endDate) {
    return dsl.selectDistinct(BENCHMARK_PRICES.TRADE_DATE)
        .from(BENCHMARK_PRICES)
        .where(BENCHMARK_PRICES.TRADE_DATE.between(startDate, endDate))
        .and(BENCHMARK_PRICES.TICKER.eq(BENCHMARK_TICKER))
        .orderBy(BENCHMARK_PRICES.TRADE_DATE.asc())
        .fetchInto(LocalDate.class);
  }

  /** Adjusted closes per category, keyed by trade date. Categories with no close are skipped. */
  public Map<LocalDate, Map<String, BigDecimal>> fetchEtfPricesByDate(
      LocalDate startDate, LocalDate endDate) {
    Map<LocalDate, Map<String, BigDecimal>> result = new TreeMap<>();
    dsl.select(RAW_PRICES.TRADE_DATE, RAW_PRICES.CATEGORY_ID, RAW_PRICES.ADJ_CLOSE)
        .from(RAW_PRICES)
        .where(RAW_PRICES.TRADE_DATE.between(startDate, endDate))
        .orderBy(RAW_PRICES.TRADE_DATE.asc())
        .fetch()
        .forEach(
            r -> {
              BigDecimal adjClose = r.get(RAW_PRICES.ADJ_CLOSE);
              if (adjClose != null) {
                result
                    .computeIfAbsent(r.get(RAW_PRICES.TRADE_DATE), d -> new HashMap<>())
                    .put(r.get(RAW_PRICES.CATEGORY_ID), adjClose);
              }
            });
    return result;
  }

  /** Adjusted benchmark closes, keyed by trade date. */
  public Map<LocalDate, BigDecimal> fetchSpyPricesByDate(LocalDate startDate, LocalDate endDate) {
    Map<LocalDate, BigDecimal> result = new TreeMap<>();
    dsl.select(BENCHMARK_PRICES.TRADE_DATE, BENCHMARK_PRICES.ADJ_CLOSE)
        .from(BENCHMARK_PRICES)
        .where(BENCHMARK_PRICES.TICKER.eq(BENCHMARK_TICKER))
        .and(BENCHMARK_PRICES.TRADE_DATE.between(startDate, endDate))
        .orderBy(BENCHMARK_PRICES.TRADE_DATE.asc())
        .fetch()
        .forEach(
            r -> {
              BigDecimal adjClose = r.get(BENCHMARK_PRICES.ADJ_CLOSE);
              if (adjClose != null) {
                result.put(r.get(BENCHMARK_PRICES.TRADE_DATE), adjClose);
              }
            });
    return result;
  }

  /** Composite scores per category, keyed by signal date, within the requested category scope. */
  public Map<LocalDate, Map<String, BigDecimal>> fetchCompositesByDate(
      LocalDate startDate, LocalDate endDate, String categoryScope) {
    Map<LocalDate, Map<String, BigDecimal>> result = new TreeMap<>();
    dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
        .from(SIGNALS)
        .join(CATEGORIES)
        .on(CATEGORIES.ID.eq(SIGNALS.CATEGORY_ID))
        .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.COMPOSITE.name()))
        .and(SIGNALS.SIGNAL_DATE.between(startDate, endDate))
        .and(categoryScopeCondition(categoryScope))
        .fetch()
        .forEach(
            r ->
                result
                    .computeIfAbsent(r.get(SIGNALS.SIGNAL_DATE), d -> new HashMap<>())
                    .put(r.get(SIGNALS.CATEGORY_ID), r.get(SIGNALS.VALUE)));
    return result;
  }

  /** The category ids a run is allowed to hold, given its scope. */
  public Set<String> fetchScopedCategoryIds(String categoryScope) {
    return new HashSet<>(
        dsl.select(CATEGORIES.ID)
            .from(CATEGORIES)
            .where(categoryScopeCondition(categoryScope))
            .fetchInto(String.class));
  }

  private Condition categoryScopeCondition(String categoryScope) {
    return switch (categoryScope.toUpperCase()) {
      case "EQUITY_SECTORS_ONLY" ->
          CATEGORIES.TYPE.eq("EQUITY_SECTOR").and(CATEGORIES.PARENT_ID.isNull());
      case "TOP_LEVEL_ONLY" -> CATEGORIES.PARENT_ID.isNull();
      default -> DSL.noCondition();
    };
  }
}

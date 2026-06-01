package com.ftm.app.signals.repository;

import static com.ftm.app.jooq.Tables.*;
import static org.jooq.impl.DSL.*;

import com.ftm.app.domain.SignalType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class SignalRepository {

  private final DSLContext dsl;

  public SignalRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public int batchUpsert(List<Row> rows) {
    if (rows.isEmpty()) return 0;
    var step =
        dsl.insertInto(
            SIGNALS,
            SIGNALS.SIGNAL_DATE,
            SIGNALS.CATEGORY_ID,
            SIGNALS.SIGNAL_TYPE,
            SIGNALS.VALUE,
            SIGNALS.COMPUTED_AT);
    for (Row row : rows) {
      step =
          step.values(
              row.signalDate(),
              row.categoryId(),
              row.signalType().name(),
              row.value(),
              OffsetDateTime.now());
    }
    return step.onConflict(SIGNALS.SIGNAL_DATE, SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_TYPE)
        .doUpdate()
        .set(SIGNALS.VALUE, excluded(SIGNALS.VALUE))
        .set(SIGNALS.COMPUTED_AT, excluded(SIGNALS.COMPUTED_AT))
        .execute();
  }

  public Optional<LocalDate> findLatestSignalDate() {
    LocalDate date =
        dsl.select(max(SIGNALS.SIGNAL_DATE)).from(SIGNALS).fetchOneInto(LocalDate.class);
    return Optional.ofNullable(date);
  }

  public List<LocalDate> findAllTradeDatesAscending() {
    return dsl.selectDistinct(RAW_PRICES.TRADE_DATE)
        .from(RAW_PRICES)
        .orderBy(RAW_PRICES.TRADE_DATE.asc())
        .fetchInto(LocalDate.class);
  }

  public boolean hasAnySignalOfType(SignalType type) {
    return dsl.fetchExists(SIGNALS, SIGNALS.SIGNAL_TYPE.eq(type.name()));
  }

  public Set<String> findAllCategoryIdsWithSignals() {
    return new HashSet<>(
        dsl.selectDistinct(SIGNALS.CATEGORY_ID).from(SIGNALS).fetchInto(String.class));
  }

  public Map<String, BigDecimal> findLatestByType(SignalType type) {
    var latestDate =
        dsl.select(max(SIGNALS.SIGNAL_DATE))
            .from(SIGNALS)
            .where(SIGNALS.SIGNAL_TYPE.eq(type.name()));

    return dsl.select(SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(type.name()).and(SIGNALS.SIGNAL_DATE.eq(latestDate)))
        .fetchMap(SIGNALS.CATEGORY_ID, SIGNALS.VALUE);
  }

  public Map<SignalType, Map<String, BigDecimal>> findLatestByTypes(List<SignalType> types) {
    if (types.isEmpty()) return Map.of();
    var typeNames = types.stream().map(SignalType::name).toList();
    var latestPerType =
        dsl.select(SIGNALS.SIGNAL_TYPE, max(SIGNALS.SIGNAL_DATE))
            .from(SIGNALS)
            .where(SIGNALS.SIGNAL_TYPE.in(typeNames))
            .groupBy(SIGNALS.SIGNAL_TYPE);
    return dsl
        .select(SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_TYPE, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(row(SIGNALS.SIGNAL_TYPE, SIGNALS.SIGNAL_DATE).in(latestPerType))
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> SignalType.valueOf(r.get(SIGNALS.SIGNAL_TYPE)),
                Collectors.toMap(r -> r.get(SIGNALS.CATEGORY_ID), r -> r.get(SIGNALS.VALUE))));
  }

  public LocalDate findPreviousSignalDate(SignalType type, LocalDate currentDate) {
    return dsl.select(max(SIGNALS.SIGNAL_DATE))
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(type.name()))
        .and(SIGNALS.SIGNAL_DATE.lt(currentDate))
        .fetchOneInto(LocalDate.class);
  }

  public Map<String, BigDecimal> findByTypeAndDate(SignalType type, LocalDate date) {
    return dsl.select(SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(type.name()))
        .and(SIGNALS.SIGNAL_DATE.eq(date))
        .fetchMap(SIGNALS.CATEGORY_ID, SIGNALS.VALUE);
  }

  public Map<LocalDate, Map<String, BigDecimal>> findByTypeForDates(
      SignalType type, Collection<LocalDate> dates) {
    if (dates.isEmpty()) return Map.of();
    return dsl
        .select(SIGNALS.SIGNAL_DATE, SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(type.name()))
        .and(SIGNALS.SIGNAL_DATE.in(dates))
        .fetch()
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> r.get(SIGNALS.SIGNAL_DATE),
                Collectors.toMap(r -> r.get(SIGNALS.CATEGORY_ID), r -> r.get(SIGNALS.VALUE))));
  }

  public List<RrgRow> findRrgTrail(int trailDays) {
    LocalDate latestDate =
        dsl.select(max(SIGNALS.SIGNAL_DATE))
            .from(SIGNALS)
            .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.RRG_RATIO.name()))
            .fetchOneInto(LocalDate.class);

    if (latestDate == null) return List.of();

    LocalDate from = latestDate.minusDays(trailDays * 2L); // 2× to cover weekends/holidays
    return dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_TYPE, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(
            SIGNALS.SIGNAL_TYPE.in(
                SignalType.RRG_RATIO.name(),
                SignalType.RRG_MOM.name(),
                SignalType.RRG_QUADRANT.name()))
        .and(SIGNALS.SIGNAL_DATE.between(from, latestDate))
        .orderBy(SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_DATE.asc(), SIGNALS.SIGNAL_TYPE.asc())
        .fetch()
        .map(
            r ->
                new RrgRow(
                    r.get(SIGNALS.SIGNAL_DATE),
                    r.get(SIGNALS.CATEGORY_ID),
                    SignalType.valueOf(r.get(SIGNALS.SIGNAL_TYPE)),
                    r.get(SIGNALS.VALUE)));
  }

  public List<Row> findAllByType(SignalType type) {
    return dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(type.name()))
        .orderBy(SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_DATE.asc())
        .fetch()
        .map(
            r ->
                new Row(
                    r.get(SIGNALS.SIGNAL_DATE),
                    r.get(SIGNALS.CATEGORY_ID),
                    type,
                    r.get(SIGNALS.VALUE)));
  }

  public List<HistoryRow> findByCategoryId(String categoryId) {
    return dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.SIGNAL_TYPE, SIGNALS.VALUE, SIGNALS.COMPUTED_AT)
        .from(SIGNALS)
        .where(SIGNALS.CATEGORY_ID.eq(categoryId))
        .orderBy(SIGNALS.SIGNAL_DATE.desc(), SIGNALS.SIGNAL_TYPE.asc())
        .fetch()
        .map(
            r ->
                new HistoryRow(
                    r.get(SIGNALS.SIGNAL_DATE),
                    SignalType.valueOf(r.get(SIGNALS.SIGNAL_TYPE)),
                    r.get(SIGNALS.VALUE),
                    r.get(SIGNALS.COMPUTED_AT)));
  }

  public record Row(
      LocalDate signalDate, String categoryId, SignalType signalType, BigDecimal value) {}

  public record HistoryRow(
      LocalDate signalDate, SignalType signalType, BigDecimal value, OffsetDateTime computedAt) {}

  public List<MacroRegimeHistoryRow> findMacroRegimeHistory(int lookbackDays) {
    LocalDate from = LocalDate.now().minusDays(lookbackDays);
    return dsl.select(SIGNALS.SIGNAL_DATE, min(SIGNALS.VALUE))
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.MACRO_REGIME.name()))
        .and(SIGNALS.SIGNAL_DATE.ge(from))
        .groupBy(SIGNALS.SIGNAL_DATE)
        .orderBy(SIGNALS.SIGNAL_DATE.asc())
        .fetch()
        .map(r -> new MacroRegimeHistoryRow(r.value1(), r.value2()));
  }

  public record RrgRow(
      LocalDate signalDate, String categoryId, SignalType signalType, BigDecimal value) {}

  public record MacroRegimeHistoryRow(LocalDate date, BigDecimal regimeOrdinal) {}

  public Map<String, BigDecimal> findRealizedVolatility20d() {
    return dsl.resultQuery("""
        WITH daily_returns AS (
          SELECT category_id,
                 trade_date,
                 LN(adj_close / LAG(adj_close) OVER (PARTITION BY category_id ORDER BY trade_date)) AS log_return,
                 ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY trade_date DESC) AS rn
          FROM raw_prices
          WHERE adj_close > 0
          AND trade_date >= CURRENT_DATE - INTERVAL '60 days'
        )
        SELECT category_id,
               STDDEV(log_return) * SQRT(252) AS annualized_vol
        FROM daily_returns
        WHERE rn <= 20 AND log_return IS NOT NULL
        GROUP BY category_id
        HAVING COUNT(*) >= 15
        """)
        .fetchMap(r -> r.get("category_id", String.class), r -> r.get("annualized_vol", BigDecimal.class));
  }

  public Map<String, Integer> findSignalDaysActive(BigDecimal threshold) {
    return dsl.resultQuery("""
        WITH ranked AS (
          SELECT category_id,
                 SUM(CASE WHEN value < {0} THEN 1 ELSE 0 END) OVER (
                   PARTITION BY category_id
                   ORDER BY signal_date DESC
                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
                 ) AS break_count
          FROM signals
          WHERE signal_type = 'COMPOSITE'
          AND signal_date >= CURRENT_DATE - INTERVAL '365 days'
        )
        SELECT category_id, COUNT(*)::int AS days_active
        FROM ranked
        WHERE break_count = 0
        GROUP BY category_id
        """, threshold)
        .fetchMap(r -> r.get("category_id", String.class), r -> r.get("days_active", Integer.class));
  }

  public List<BuySignalWinRateRow> findBuySignalWinRates(int lookbackDays) {
    return dsl.resultQuery("""
        WITH daily_signals AS (
          SELECT category_id, signal_date, value,
                 LAG(value) OVER (PARTITION BY category_id ORDER BY signal_date) AS prev_value
          FROM signals
          WHERE signal_type = 'COMPOSITE'
        ),
        new_buy_signals AS (
          SELECT category_id, signal_date
          FROM daily_signals
          WHERE value >= 0.65 AND (prev_value IS NULL OR prev_value < 0.65)
          AND signal_date >= CURRENT_DATE - INTERVAL '{0} days'
        ),
        forward_prices AS (
          SELECT nbs.category_id, nbs.signal_date,
                 p_entry.adj_close AS entry_price,
                 p_fwd.adj_close   AS fwd_price
          FROM new_buy_signals nbs
          JOIN raw_prices p_entry
            ON p_entry.category_id = nbs.category_id AND p_entry.trade_date = nbs.signal_date
          JOIN LATERAL (
            SELECT adj_close FROM raw_prices
            WHERE category_id = nbs.category_id
              AND trade_date > nbs.signal_date + INTERVAL '28 days'
              AND trade_date <= nbs.signal_date + INTERVAL '40 days'
            ORDER BY trade_date ASC LIMIT 1
          ) p_fwd ON true
          WHERE p_entry.adj_close > 0
        )
        SELECT category_id,
               COUNT(*)::int                                                              AS signal_count,
               ROUND(AVG(CASE WHEN fwd_price > entry_price THEN 1.0 ELSE 0.0 END)::numeric, 3) AS win_rate,
               ROUND(AVG((fwd_price - entry_price) / entry_price)::numeric, 4)           AS avg_return_30d
        FROM forward_prices
        GROUP BY category_id
        HAVING COUNT(*) >= 2
        ORDER BY win_rate DESC
        """.replace("{0}", String.valueOf(lookbackDays)))
        .fetch()
        .map(r -> new BuySignalWinRateRow(
            r.get("category_id", String.class),
            r.get("signal_count", Integer.class),
            r.get("win_rate", BigDecimal.class),
            r.get("avg_return_30d", BigDecimal.class)));
  }

  public record BuySignalWinRateRow(
      String categoryId, int signalCount, BigDecimal winRate, BigDecimal avgReturn30d) {}

  public Map<String, List<BigDecimal>> findCompositeScoreHistory(
      int days, Collection<String> categoryIds) {
    if (categoryIds.isEmpty()) return Map.of();
    List<LocalDate> recentDates =
        dsl.selectDistinct(SIGNALS.SIGNAL_DATE)
            .from(SIGNALS)
            .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.COMPOSITE.name()))
            .orderBy(SIGNALS.SIGNAL_DATE.desc())
            .limit(days)
            .fetchInto(LocalDate.class);

    if (recentDates.isEmpty()) return Map.of();

    Map<String, List<BigDecimal>> result = new LinkedHashMap<>();
    dsl.select(SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_DATE, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.COMPOSITE.name()))
        .and(SIGNALS.SIGNAL_DATE.in(recentDates))
        .and(SIGNALS.CATEGORY_ID.in(categoryIds))
        .orderBy(SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_DATE.asc())
        .fetch()
        .forEach(
            r ->
                result
                    .computeIfAbsent(r.get(SIGNALS.CATEGORY_ID), k -> new ArrayList<>())
                    .add(r.get(SIGNALS.VALUE)));
    return result;
  }
}

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
import org.springframework.cache.annotation.Cacheable;
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

  public List<HistoryRow> findByCategoryId(String categoryId, int days) {
    var condition = SIGNALS.CATEGORY_ID.eq(categoryId);
    if (days > 0) {
      condition = condition.and(SIGNALS.SIGNAL_DATE.ge(LocalDate.now().minusDays(days)));
    }
    return dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.SIGNAL_TYPE, SIGNALS.VALUE, SIGNALS.COMPUTED_AT)
        .from(SIGNALS)
        .where(condition)
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
    return dsl.resultQuery(
            """
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
        .fetchMap(
            r -> r.get("category_id", String.class),
            r -> r.get("annualized_vol", BigDecimal.class));
  }

  @Cacheable(value = "signal-days-active", key = "#threshold")
  public Map<String, Integer> findSignalDaysActive(BigDecimal threshold) {
    return dsl.resultQuery(
            """
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
        """,
            threshold)
        .fetchMap(
            r -> r.get("category_id", String.class), r -> r.get("days_active", Integer.class));
  }

  public List<BuySignalWinRateRow> findBuySignalWinRates(int lookbackDays) {
    return dsl.resultQuery(
            """
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
                 p_entry.adj_close  AS entry_price,
                 p_fwd30.adj_close  AS fwd_price_30d,
                 p_fwd90.adj_close  AS fwd_price_90d
          FROM new_buy_signals nbs
          JOIN raw_prices p_entry
            ON p_entry.category_id = nbs.category_id AND p_entry.trade_date = nbs.signal_date
          JOIN LATERAL (
            SELECT adj_close FROM raw_prices
            WHERE category_id = nbs.category_id
              AND trade_date > nbs.signal_date + INTERVAL '28 days'
              AND trade_date <= nbs.signal_date + INTERVAL '40 days'
            ORDER BY trade_date ASC LIMIT 1
          ) p_fwd30 ON true
          LEFT JOIN LATERAL (
            SELECT adj_close FROM raw_prices
            WHERE category_id = nbs.category_id
              AND trade_date > nbs.signal_date + INTERVAL '85 days'
              AND trade_date <= nbs.signal_date + INTERVAL '95 days'
            ORDER BY trade_date ASC LIMIT 1
          ) p_fwd90 ON true
          WHERE p_entry.adj_close > 0
        )
        SELECT category_id,
               COUNT(*)::int                                                                       AS signal_count,
               ROUND(AVG(CASE WHEN fwd_price_30d > entry_price THEN 1.0 ELSE 0.0 END)::numeric, 3) AS win_rate,
               ROUND(AVG((fwd_price_30d - entry_price) / entry_price)::numeric, 4)                AS avg_return_30d,
               ROUND(AVG((fwd_price_90d - entry_price) / entry_price)::numeric, 4)                AS avg_return_90d
        FROM forward_prices
        GROUP BY category_id
        HAVING COUNT(*) >= 2
        ORDER BY win_rate DESC
        """
                .replace("{0}", String.valueOf(lookbackDays)))
        .fetch()
        .map(
            r ->
                new BuySignalWinRateRow(
                    r.get("category_id", String.class),
                    r.get("signal_count", Integer.class),
                    r.get("win_rate", BigDecimal.class),
                    r.get("avg_return_30d", BigDecimal.class),
                    r.get("avg_return_90d", BigDecimal.class)));
  }

  public record BuySignalWinRateRow(
      String categoryId,
      int signalCount,
      BigDecimal winRate,
      BigDecimal avgReturn30d,
      BigDecimal avgReturn90d) {}

  /**
   * Returns two signal snapshots (current + N-days-ago) for computing signal transitions.
   *
   * <p>Each row contains COMPOSITE, RRG_QUADRANT, and COMPOSITE_TREND_20D values for a category at
   * both the current date and the latest available date that is at least {@code lookbackDays}
   * calendar days before the current date.
   */
  public List<SignalSnapshotPair> findSignalSnapshotPairs(int lookbackDays) {
    return dsl.resultQuery(
            """
        WITH
        latest_date AS (
          SELECT MAX(signal_date) AS dt FROM signals WHERE signal_type = 'COMPOSITE'
        ),
        past_date AS (
          SELECT MAX(signal_date) AS dt
          FROM signals
          WHERE signal_type = 'COMPOSITE'
            AND signal_date <= (SELECT dt FROM latest_date) - INTERVAL '{days} days'
        ),
        current_signals AS (
          SELECT s.category_id,
                 MAX(CASE WHEN s.signal_type = 'COMPOSITE'          THEN s.value END) AS composite_score,
                 MAX(CASE WHEN s.signal_type = 'RRG_QUADRANT'       THEN s.value END) AS rrg_quadrant,
                 MAX(CASE WHEN s.signal_type = 'COMPOSITE_TREND_20D' THEN s.value END) AS trend_20d
          FROM signals s, latest_date
          WHERE s.signal_date = latest_date.dt
            AND s.signal_type IN ('COMPOSITE','RRG_QUADRANT','COMPOSITE_TREND_20D')
          GROUP BY s.category_id
        ),
        past_signals AS (
          SELECT s.category_id,
                 MAX(CASE WHEN s.signal_type = 'COMPOSITE'          THEN s.value END) AS composite_score,
                 MAX(CASE WHEN s.signal_type = 'RRG_QUADRANT'       THEN s.value END) AS rrg_quadrant,
                 MAX(CASE WHEN s.signal_type = 'COMPOSITE_TREND_20D' THEN s.value END) AS trend_20d
          FROM signals s, past_date
          WHERE s.signal_date = past_date.dt
            AND s.signal_type IN ('COMPOSITE','RRG_QUADRANT','COMPOSITE_TREND_20D')
          GROUP BY s.category_id
        )
        SELECT
          c.category_id,
          c.composite_score  AS cur_score,
          c.rrg_quadrant     AS cur_rrg,
          c.trend_20d        AS cur_trend,
          p.composite_score  AS prev_score,
          p.rrg_quadrant     AS prev_rrg,
          p.trend_20d        AS prev_trend,
          past_date.dt       AS comparison_date
        FROM current_signals c
        JOIN past_signals p ON c.category_id = p.category_id
        CROSS JOIN past_date
        WHERE c.composite_score IS NOT NULL AND p.composite_score IS NOT NULL
        """
                .replace("{days}", String.valueOf(lookbackDays)))
        .fetch()
        .map(
            r ->
                new SignalSnapshotPair(
                    r.get("category_id", String.class),
                    r.get("cur_score", BigDecimal.class),
                    r.get("cur_rrg", BigDecimal.class),
                    r.get("cur_trend", BigDecimal.class),
                    r.get("prev_score", BigDecimal.class),
                    r.get("prev_rrg", BigDecimal.class),
                    r.get("prev_trend", BigDecimal.class),
                    r.get("comparison_date", java.time.LocalDate.class)));
  }

  public record SignalSnapshotPair(
      String categoryId,
      BigDecimal currentScore,
      BigDecimal currentRrg,
      BigDecimal currentTrend,
      BigDecimal previousScore,
      BigDecimal previousRrg,
      BigDecimal previousTrend,
      java.time.LocalDate comparisonDate) {}

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

  public List<DateScore> findAverageCompositeByDate(
      Collection<String> categoryIds, int tradingDays) {
    if (categoryIds.isEmpty()) return List.of();
    var recentDates =
        dsl.selectDistinct(SIGNALS.SIGNAL_DATE)
            .from(SIGNALS)
            .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.COMPOSITE.name()))
            .orderBy(SIGNALS.SIGNAL_DATE.desc())
            .limit(tradingDays);
    return dsl.select(SIGNALS.SIGNAL_DATE, avg(SIGNALS.VALUE).as("avg_composite"))
        .from(SIGNALS)
        .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.COMPOSITE.name()))
        .and(SIGNALS.SIGNAL_DATE.in(recentDates))
        .and(SIGNALS.CATEGORY_ID.in(categoryIds))
        .groupBy(SIGNALS.SIGNAL_DATE)
        .orderBy(SIGNALS.SIGNAL_DATE.asc())
        .fetch()
        .map(
            r ->
                new DateScore(
                    r.get(SIGNALS.SIGNAL_DATE),
                    r.get("avg_composite", BigDecimal.class).doubleValue()));
  }

  public record DateScore(LocalDate date, double averageComposite) {}

  public List<DateHistory> findAverageHistoryByDate(
      Collection<String> categoryIds, int tradingDays) {
    if (categoryIds.isEmpty()) return List.of();
    String[] idArray = categoryIds.toArray(new String[0]);
    return dsl.resultQuery(
            """
            SELECT
              signal_date,
              AVG(CASE WHEN signal_type = 'COMPOSITE' THEN value END)           AS avg_composite,
              AVG(CASE WHEN signal_type = 'COMPOSITE_TREND_5D' THEN value END)  AS avg_trend5d,
              AVG(CASE WHEN signal_type = 'COMPOSITE_TREND_20D' THEN value END) AS avg_trend20d
            FROM signals
            WHERE signal_date IN (
              SELECT DISTINCT signal_date FROM signals
              WHERE signal_type = 'COMPOSITE'
                AND category_id = ANY({0})
              ORDER BY signal_date DESC
              LIMIT {1}
            )
            AND category_id = ANY({0})
            AND signal_type IN ('COMPOSITE', 'COMPOSITE_TREND_5D', 'COMPOSITE_TREND_20D')
            GROUP BY signal_date
            HAVING AVG(CASE WHEN signal_type = 'COMPOSITE' THEN value END) IS NOT NULL
            ORDER BY signal_date ASC
            """,
            val(idArray), val(tradingDays))
        .fetch()
        .map(
            r -> {
              BigDecimal composite = r.get("avg_composite", BigDecimal.class);
              BigDecimal trend5d = r.get("avg_trend5d", BigDecimal.class);
              BigDecimal trend20d = r.get("avg_trend20d", BigDecimal.class);
              return new DateHistory(
                  r.get("signal_date", LocalDate.class),
                  composite.doubleValue(),
                  trend5d != null ? trend5d.doubleValue() : null,
                  trend20d != null ? trend20d.doubleValue() : null);
            });
  }

  public record DateHistory(
      LocalDate date, double averageComposite, Double averageTrend5d, Double averageTrend20d) {}

  @Cacheable("score-streak-90d")
  public Map<String, Integer> findScoreStreakDays() {
    return dsl.resultQuery(
            """
        WITH ordered AS (
          SELECT category_id, signal_date, value,
            value - LAG(value) OVER (PARTITION BY category_id ORDER BY signal_date ASC) AS delta,
            ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY signal_date DESC) AS rn_from_end
          FROM signals
          WHERE signal_type = 'COMPOSITE'
            AND signal_date >= CURRENT_DATE - INTERVAL '90 days'
        ),
        directions AS (
          SELECT category_id, rn_from_end,
            SIGN(delta)::int AS dir
          FROM ordered
          WHERE delta IS NOT NULL
        ),
        current_direction AS (
          SELECT category_id, dir AS latest_dir
          FROM directions
          WHERE rn_from_end = 1
        ),
        streak_bounds AS (
          SELECT d.category_id,
            cd.latest_dir,
            MIN(CASE WHEN d.dir != cd.latest_dir THEN d.rn_from_end END) AS first_break_rn,
            MAX(d.rn_from_end) AS max_rn
          FROM directions d
          JOIN current_direction cd ON d.category_id = cd.category_id
          GROUP BY d.category_id, cd.latest_dir
        )
        SELECT category_id,
          (latest_dir * COALESCE(first_break_rn - 1, max_rn))::int AS score_streak_days
        FROM streak_bounds
        WHERE latest_dir != 0
        """)
        .fetchMap(
            r -> r.get("category_id", String.class),
            r -> r.get("score_streak_days", Integer.class));
  }

  @Cacheable("score-percentile-252d")
  public Map<String, BigDecimal> findScorePercentile252d() {
    return dsl.resultQuery(
            """
        WITH all_scores AS (
          SELECT category_id,
                 signal_date,
                 value,
                 PERCENT_RANK() OVER (PARTITION BY category_id ORDER BY value) AS pct_rank
          FROM signals
          WHERE signal_type = 'COMPOSITE'
            AND signal_date >= CURRENT_DATE - INTERVAL '252 days'
        ),
        latest_dates AS (
          SELECT category_id, MAX(signal_date) AS latest_date
          FROM all_scores
          GROUP BY category_id
          HAVING COUNT(*) >= 20
        )
        SELECT a.category_id, a.pct_rank
        FROM all_scores a
        JOIN latest_dates l ON a.category_id = l.category_id AND a.signal_date = l.latest_date
        """)
        .fetchMap(
            r -> r.get("category_id", String.class), r -> r.get("pct_rank", BigDecimal.class));
  }
}

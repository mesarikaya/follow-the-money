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

/**
 * Reads and writes individual signals: store a day's values, ask for the latest of a type, walk back
 * to the previous signal date, average a theme's history. The derived, analytical questions —
 * volatility, win rates, percentiles, rotation trails — live in {@link SignalAnalyticsRepository}.
 */
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

}

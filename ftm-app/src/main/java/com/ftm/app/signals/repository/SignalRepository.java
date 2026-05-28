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
    return dsl.select(SIGNALS.CATEGORY_ID, SIGNALS.SIGNAL_TYPE, SIGNALS.VALUE)
        .from(SIGNALS)
        .where(row(SIGNALS.SIGNAL_TYPE, SIGNALS.SIGNAL_DATE).in(latestPerType))
        .stream()
        .collect(
            Collectors.groupingBy(
                r -> SignalType.valueOf(r.get(SIGNALS.SIGNAL_TYPE)),
                Collectors.toMap(
                    r -> r.get(SIGNALS.CATEGORY_ID),
                    r -> r.get(SIGNALS.VALUE))));
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
        .map(r -> new Row(r.get(SIGNALS.SIGNAL_DATE), r.get(SIGNALS.CATEGORY_ID), type, r.get(SIGNALS.VALUE)));
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

  public Map<String, List<BigDecimal>> findCompositeScoreHistory(
      int days, Collection<String> categoryIds) {
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

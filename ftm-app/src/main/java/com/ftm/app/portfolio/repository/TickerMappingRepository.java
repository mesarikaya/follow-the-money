package com.ftm.app.portfolio.repository;

import static org.jooq.impl.DSL.field;
import static org.jooq.impl.DSL.table;

import com.ftm.app.portfolio.domain.TickerMapping;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.jooq.DSLContext;
import org.jooq.Field;
import org.jooq.Record;
import org.jooq.Table;
import org.springframework.stereotype.Repository;

// String-based jOOQ access until next mvnw compile generates the typed TICKER_CATEGORY_MAP class.
@Repository
public class TickerMappingRepository {

  private static final Table<Record> TICKER_CATEGORY_MAP = table("ticker_category_map");
  private static final Field<String> TICKER = field("ticker", String.class);
  private static final Field<String> CATEGORY_ID = field("category_id", String.class);
  private static final Field<String> NOTES = field("notes", String.class);
  private static final Field<OffsetDateTime> UPDATED_AT = field("updated_at", OffsetDateTime.class);

  private final DSLContext dsl;

  public TickerMappingRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public Map<String, String> findAllAsMap() {
    return dsl.select(TICKER, CATEGORY_ID).from(TICKER_CATEGORY_MAP).fetch().stream()
        .collect(
            java.util.stream.Collectors.toMap(
                r -> r.get(TICKER).toUpperCase(), r -> r.get(CATEGORY_ID)));
  }

  public List<TickerMapping> findAll() {
    return dsl.select(TICKER, CATEGORY_ID, NOTES, UPDATED_AT)
        .from(TICKER_CATEGORY_MAP)
        .orderBy(CATEGORY_ID.asc(), TICKER.asc())
        .fetch()
        .map(r -> new TickerMapping(r.value1(), r.value2(), r.value3(), r.value4()));
  }

  public Optional<TickerMapping> findByTicker(String ticker) {
    return dsl.select(TICKER, CATEGORY_ID, NOTES, UPDATED_AT)
        .from(TICKER_CATEGORY_MAP)
        .where(TICKER.eq(ticker.toUpperCase()))
        .fetchOptional()
        .map(
            r ->
                new TickerMapping(
                    r.get(TICKER), r.get(CATEGORY_ID), r.get(NOTES), r.get(UPDATED_AT)));
  }

  public void upsert(String ticker, String categoryId, String notes) {
    dsl.insertInto(TICKER_CATEGORY_MAP, TICKER, CATEGORY_ID, NOTES, UPDATED_AT)
        .values(ticker.toUpperCase(), categoryId, notes, OffsetDateTime.now())
        .onConflict(TICKER)
        .doUpdate()
        .set(CATEGORY_ID, categoryId)
        .set(NOTES, notes)
        .set(UPDATED_AT, OffsetDateTime.now())
        .execute();
  }

  public int delete(String ticker) {
    return dsl.deleteFrom(TICKER_CATEGORY_MAP).where(TICKER.eq(ticker.toUpperCase())).execute();
  }
}

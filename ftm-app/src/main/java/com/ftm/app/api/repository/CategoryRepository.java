package com.ftm.app.api.repository;

import static com.ftm.app.jooq.Tables.CATEGORIES;
import static com.ftm.app.jooq.Tables.RAW_PRICES;
import static org.jooq.impl.DSL.max;

import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

@Repository
public class CategoryRepository {

  public record CategoryPriceRow(Category category, BigDecimal latestClose, LocalDate priceDate) {}

  private final DSLContext dsl;

  public CategoryRepository(DSLContext dsl) {
    this.dsl = dsl;
  }

  public List<Category> findAllByActiveTrueOrderByDisplayOrderAsc() {
    return dsl.selectFrom(CATEGORIES)
        .where(CATEGORIES.ACTIVE.isTrue())
        .orderBy(CATEGORIES.DISPLAY_ORDER.asc())
        .fetch()
        .map(
            r ->
                new Category(
                    CategoryId.valueOf(r.getId()),
                    r.getName(),
                    CategoryType.valueOf(r.getType()),
                    r.getEtfTicker(),
                    r.getBenchmarkTicker(),
                    r.getDisplayOrder(),
                    r.getActive(),
                    r.getParentId()));
  }

  public List<CategoryPriceRow> findAllWithLatestPrice() {
    var maxDates =
        dsl.select(RAW_PRICES.CATEGORY_ID, max(RAW_PRICES.TRADE_DATE).as("max_trade_date"))
            .from(RAW_PRICES)
            .groupBy(RAW_PRICES.CATEGORY_ID)
            .asTable("max_dates");

    return dsl.select(
            CATEGORIES.ID,
            CATEGORIES.NAME,
            CATEGORIES.TYPE,
            CATEGORIES.ETF_TICKER,
            CATEGORIES.BENCHMARK_TICKER,
            CATEGORIES.DISPLAY_ORDER,
            CATEGORIES.ACTIVE,
            RAW_PRICES.CLOSE,
            RAW_PRICES.TRADE_DATE)
        .from(CATEGORIES)
        .leftJoin(maxDates)
        .on(CATEGORIES.ID.eq(maxDates.field("category_id", String.class)))
        .leftJoin(RAW_PRICES)
        .on(
            RAW_PRICES
                .CATEGORY_ID
                .eq(CATEGORIES.ID)
                .and(RAW_PRICES.TRADE_DATE.eq(maxDates.field("max_trade_date", LocalDate.class))))
        .where(CATEGORIES.ACTIVE.isTrue())
        .and(CATEGORIES.PARENT_ID.isNull())
        .orderBy(CATEGORIES.DISPLAY_ORDER.asc())
        .fetch()
        .map(
            r ->
                new CategoryPriceRow(
                    new Category(
                        CategoryId.valueOf(r.get(CATEGORIES.ID)),
                        r.get(CATEGORIES.NAME),
                        CategoryType.valueOf(r.get(CATEGORIES.TYPE)),
                        r.get(CATEGORIES.ETF_TICKER),
                        r.get(CATEGORIES.BENCHMARK_TICKER),
                        r.get(CATEGORIES.DISPLAY_ORDER),
                        r.get(CATEGORIES.ACTIVE),
                        null),
                    r.get(RAW_PRICES.CLOSE),
                    r.get(RAW_PRICES.TRADE_DATE)));
  }

  public Set<String> findTopLevelActiveCategoryIds() {
    return new HashSet<>(
        dsl.select(CATEGORIES.ID)
            .from(CATEGORIES)
            .where(CATEGORIES.ACTIVE.isTrue())
            .and(CATEGORIES.PARENT_ID.isNull())
            .fetchInto(String.class));
  }

  public Set<String> findTopLevelActiveCategoryIdsByType(CategoryType type) {
    return new HashSet<>(
        dsl.select(CATEGORIES.ID)
            .from(CATEGORIES)
            .where(CATEGORIES.ACTIVE.isTrue())
            .and(CATEGORIES.PARENT_ID.isNull())
            .and(CATEGORIES.TYPE.eq(type.name()))
            .fetchInto(String.class));
  }

  public List<PriceLevelRow> findPriceLevels() {
    return dsl.resultQuery(
            """
        WITH categorized AS (
          SELECT category_id, trade_date, adj_close,
                 ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY trade_date DESC) AS rn
          FROM raw_prices
          WHERE adj_close > 0
          AND trade_date >= CURRENT_DATE - INTERVAL '400 days'
        ),
        current_prices AS (
          SELECT category_id, adj_close AS current_price
          FROM categorized WHERE rn = 1
        ),
        yearly_range AS (
          SELECT category_id,
                 MAX(adj_close) AS high_252d,
                 MIN(adj_close) AS low_252d,
                 COUNT(*)::int  AS days_of_data
          FROM categorized
          WHERE rn <= 252
          GROUP BY category_id
        )
        SELECT cp.category_id,
               cp.current_price,
               yr.high_252d,
               yr.low_252d,
               yr.days_of_data,
               ROUND((cp.current_price - yr.high_252d) / yr.high_252d, 4)    AS drawdown_from_high,
               ROUND(CASE WHEN (yr.high_252d - yr.low_252d) > 0
                 THEN (cp.current_price - yr.low_252d) / (yr.high_252d - yr.low_252d)
                 ELSE 0.5 END, 4)                                             AS position_in_range
        FROM current_prices cp
        JOIN yearly_range yr ON cp.category_id = yr.category_id
        WHERE yr.days_of_data >= 30
        """)
        .fetch()
        .map(
            r ->
                new PriceLevelRow(
                    r.get("category_id", String.class),
                    r.get("current_price", BigDecimal.class),
                    r.get("high_252d", BigDecimal.class),
                    r.get("low_252d", BigDecimal.class),
                    r.get("drawdown_from_high", BigDecimal.class),
                    r.get("position_in_range", BigDecimal.class),
                    r.get("days_of_data", Integer.class)));
  }

  public record PriceLevelRow(
      String categoryId,
      BigDecimal currentPrice,
      BigDecimal high252d,
      BigDecimal low252d,
      BigDecimal drawdownFromHigh,
      BigDecimal positionInRange,
      int daysOfData) {}

  public List<Category> findSubCategoriesByParentId(String parentId) {
    return dsl.selectFrom(CATEGORIES)
        .where(CATEGORIES.PARENT_ID.eq(parentId))
        .and(CATEGORIES.ACTIVE.isTrue())
        .orderBy(CATEGORIES.DISPLAY_ORDER.asc())
        .fetch()
        .map(
            r ->
                new Category(
                    CategoryId.valueOf(r.getId()),
                    r.getName(),
                    CategoryType.valueOf(r.getType()),
                    r.getEtfTicker(),
                    r.getBenchmarkTicker(),
                    r.getDisplayOrder(),
                    r.getActive(),
                    r.getParentId()));
  }
}

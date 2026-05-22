package com.ftm.app.api.repository;

import static com.ftm.app.jooq.Tables.CATEGORIES;
import static com.ftm.app.jooq.Tables.RAW_PRICES;
import static org.jooq.impl.DSL.max;

import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.CategoryType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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

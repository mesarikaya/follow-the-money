package com.ftm.app.ingestion.repository;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static com.ftm.app.jooq.Tables.RAW_PRICES;

@Repository
public class RawPriceRepository {

    private final DSLContext dsl;

    public RawPriceRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int batchInsert(List<Row> rows) {
        if (rows.isEmpty()) return 0;
        var step = dsl.insertInto(RAW_PRICES,
                RAW_PRICES.TRADE_DATE,
                RAW_PRICES.CATEGORY_ID,
                RAW_PRICES.OPEN,
                RAW_PRICES.HIGH,
                RAW_PRICES.LOW,
                RAW_PRICES.CLOSE,
                RAW_PRICES.ADJ_CLOSE,
                RAW_PRICES.VOLUME);
        for (Row row : rows) {
            step = step.values(
                    row.tradeDate(), row.categoryId(),
                    row.open(), row.high(), row.low(), row.close(),
                    row.adjClose(), row.volume());
        }
        return step.onConflictDoNothing()
                .returning(RAW_PRICES.TRADE_DATE)
                .fetch()
                .size();
    }

    public Optional<LocalDate> findMaxTradeDate(String categoryId) {
        return Optional.ofNullable(
                dsl.select(RAW_PRICES.TRADE_DATE.max())
                        .from(RAW_PRICES)
                        .where(RAW_PRICES.CATEGORY_ID.eq(categoryId))
                        .fetchOne(RAW_PRICES.TRADE_DATE.max()));
    }

    public int countAll() {
        return dsl.fetchCount(RAW_PRICES);
    }

    public record Row(
            LocalDate tradeDate,
            String categoryId,
            BigDecimal open,
            BigDecimal high,
            BigDecimal low,
            BigDecimal close,
            BigDecimal adjClose,
            long volume
    ) {}
}

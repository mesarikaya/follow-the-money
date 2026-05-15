package com.ftm.app.ingestion.repository;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static com.ftm.app.jooq.Tables.BENCHMARK_PRICES;

@Repository
public class BenchmarkPriceRepository {

    private final DSLContext dsl;

    public BenchmarkPriceRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int batchInsert(List<Row> rows) {
        if (rows.isEmpty()) return 0;
        var step = dsl.insertInto(BENCHMARK_PRICES,
                BENCHMARK_PRICES.TRADE_DATE,
                BENCHMARK_PRICES.TICKER,
                BENCHMARK_PRICES.ADJ_CLOSE);
        for (Row row : rows) {
            step = step.values(row.tradeDate(), row.ticker(), row.adjClose());
        }
        return step.onConflictDoNothing()
                .returning(BENCHMARK_PRICES.TRADE_DATE)
                .fetch()
                .size();
    }

    public Optional<LocalDate> findMaxTradeDate(String ticker) {
        return Optional.ofNullable(
                dsl.select(BENCHMARK_PRICES.TRADE_DATE.max())
                        .from(BENCHMARK_PRICES)
                        .where(BENCHMARK_PRICES.TICKER.eq(ticker))
                        .fetchOne(BENCHMARK_PRICES.TRADE_DATE.max()));
    }

    public int countAll() {
        return dsl.fetchCount(BENCHMARK_PRICES);
    }

    public record Row(LocalDate tradeDate, String ticker, BigDecimal adjClose) {}
}

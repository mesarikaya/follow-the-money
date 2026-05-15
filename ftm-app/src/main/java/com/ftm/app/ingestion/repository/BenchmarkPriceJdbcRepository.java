package com.ftm.app.ingestion.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class BenchmarkPriceJdbcRepository {

    private static final String UPSERT = """
            INSERT INTO benchmark_prices (trade_date, ticker, adj_close)
            VALUES (?, ?, ?)
            ON CONFLICT (trade_date, ticker) DO NOTHING
            """;

    private final JdbcTemplate jdbc;

    public BenchmarkPriceJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int batchInsert(List<Row> rows) {
        int[][] counts = jdbc.batchUpdate(UPSERT, rows, 100, (ps, r) -> {
            ps.setDate(1, Date.valueOf(r.tradeDate()));
            ps.setString(2, r.ticker());
            ps.setBigDecimal(3, r.adjClose());
        });
        int total = 0;
        for (int[] batch : counts) for (int c : batch) if (c >= 0) total += c;
        return total;
    }

    public Optional<LocalDate> findMaxTradeDate(String ticker) {
        Date d = jdbc.queryForObject(
                "SELECT MAX(trade_date) FROM benchmark_prices WHERE ticker = ?",
                Date.class, ticker);
        return Optional.ofNullable(d).map(Date::toLocalDate);
    }

    public record Row(LocalDate tradeDate, String ticker, BigDecimal adjClose) {}
}

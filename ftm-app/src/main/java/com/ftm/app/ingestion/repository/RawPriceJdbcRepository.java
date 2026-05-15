package com.ftm.app.ingestion.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class RawPriceJdbcRepository {

    private static final String UPSERT = """
            INSERT INTO raw_prices (trade_date, category_id, open, high, low, close, adj_close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (trade_date, category_id) DO NOTHING
            """;

    private final JdbcTemplate jdbc;

    public RawPriceJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int batchInsert(List<Row> rows) {
        int[][] counts = jdbc.batchUpdate(UPSERT, rows, 100, (ps, r) -> {
            ps.setDate(1, Date.valueOf(r.tradeDate()));
            ps.setString(2, r.categoryId());
            ps.setBigDecimal(3, r.open());
            ps.setBigDecimal(4, r.high());
            ps.setBigDecimal(5, r.low());
            ps.setBigDecimal(6, r.close());
            ps.setBigDecimal(7, r.adjClose());
            ps.setLong(8, r.volume());
        });
        int total = 0;
        for (int[] batch : counts) for (int c : batch) if (c >= 0) total += c;
        return total;
    }

    public Optional<LocalDate> findMaxTradeDate(String categoryId) {
        Date d = jdbc.queryForObject(
                "SELECT MAX(trade_date) FROM raw_prices WHERE category_id = ?",
                Date.class, categoryId);
        return Optional.ofNullable(d).map(Date::toLocalDate);
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

package com.ftm.app.ingestion.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public class MacroIndicatorJdbcRepository {

    private static final String UPSERT = """
            INSERT INTO macro_indicators (observation_date, series_id, value, source)
            VALUES (?, ?, ?, 'FRED')
            ON CONFLICT (observation_date, series_id) DO NOTHING
            """;

    private final JdbcTemplate jdbc;

    public MacroIndicatorJdbcRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public int batchInsert(List<Row> rows) {
        int[][] counts = jdbc.batchUpdate(UPSERT, rows, 100, (ps, r) -> {
            ps.setDate(1, Date.valueOf(r.observationDate()));
            ps.setString(2, r.seriesId());
            if (r.value() != null) ps.setBigDecimal(3, r.value());
            else ps.setNull(3, java.sql.Types.NUMERIC);
        });
        int total = 0;
        for (int[] batch : counts) for (int c : batch) if (c >= 0) total += c;
        return total;
    }

    public Optional<LocalDate> findMaxObservationDate(String seriesId) {
        Date d = jdbc.queryForObject(
                "SELECT MAX(observation_date) FROM macro_indicators WHERE series_id = ?",
                Date.class, seriesId);
        return Optional.ofNullable(d).map(Date::toLocalDate);
    }

    public int countAll() {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM macro_indicators", Integer.class);
        return count != null ? count : 0;
    }

    public record Row(LocalDate observationDate, String seriesId, BigDecimal value) {}
}

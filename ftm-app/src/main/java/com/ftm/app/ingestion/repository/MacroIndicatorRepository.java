package com.ftm.app.ingestion.repository;

import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static com.ftm.app.jooq.Tables.MACRO_INDICATORS;

@Repository
public class MacroIndicatorRepository {

    private final DSLContext dsl;

    public MacroIndicatorRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int batchInsert(List<Row> rows) {
        if (rows.isEmpty()) return 0;
        var step = dsl.insertInto(MACRO_INDICATORS,
                MACRO_INDICATORS.OBSERVATION_DATE,
                MACRO_INDICATORS.SERIES_ID,
                MACRO_INDICATORS.VALUE,
                MACRO_INDICATORS.SOURCE);
        for (Row row : rows) {
            step = step.values(row.observationDate(), row.seriesId(), row.value(), "FRED");
        }
        return step.onConflictDoNothing()
                .returning(MACRO_INDICATORS.OBSERVATION_DATE)
                .fetch()
                .size();
    }

    public Optional<LocalDate> findMaxObservationDate(String seriesId) {
        return Optional.ofNullable(
                dsl.select(MACRO_INDICATORS.OBSERVATION_DATE.max())
                        .from(MACRO_INDICATORS)
                        .where(MACRO_INDICATORS.SERIES_ID.eq(seriesId))
                        .fetchOne(MACRO_INDICATORS.OBSERVATION_DATE.max()));
    }

    public int countAll() {
        return dsl.fetchCount(MACRO_INDICATORS);
    }

    public record Row(LocalDate observationDate, String seriesId, BigDecimal value) {}
}

package com.ftm.app.signals.repository;

import com.ftm.app.domain.SignalType;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import static com.ftm.app.jooq.Tables.SIGNALS;
import static org.jooq.impl.DSL.*;

@Repository
public class SignalRepository {

    private final DSLContext dsl;

    public SignalRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public int batchUpsert(List<Row> rows) {
        if (rows.isEmpty()) return 0;
        var step = dsl.insertInto(SIGNALS,
                SIGNALS.SIGNAL_DATE,
                SIGNALS.CATEGORY_ID,
                SIGNALS.SIGNAL_TYPE,
                SIGNALS.VALUE,
                SIGNALS.COMPUTED_AT);
        for (Row row : rows) {
            step = step.values(
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

    public Map<String, BigDecimal> findLatestByType(SignalType type) {
        var latestDate = dsl.select(max(SIGNALS.SIGNAL_DATE))
                .from(SIGNALS)
                .where(SIGNALS.SIGNAL_TYPE.eq(type.name()));

        return dsl.select(SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
                .from(SIGNALS)
                .where(SIGNALS.SIGNAL_TYPE.eq(type.name())
                        .and(SIGNALS.SIGNAL_DATE.eq(latestDate)))
                .fetchMap(SIGNALS.CATEGORY_ID, SIGNALS.VALUE);
    }

    public List<HistoryRow> findByCategoryId(String categoryId) {
        return dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.SIGNAL_TYPE, SIGNALS.VALUE, SIGNALS.COMPUTED_AT)
                .from(SIGNALS)
                .where(SIGNALS.CATEGORY_ID.eq(categoryId))
                .orderBy(SIGNALS.SIGNAL_DATE.desc(), SIGNALS.SIGNAL_TYPE.asc())
                .fetch()
                .map(r -> new HistoryRow(
                        r.get(SIGNALS.SIGNAL_DATE),
                        SignalType.valueOf(r.get(SIGNALS.SIGNAL_TYPE)),
                        r.get(SIGNALS.VALUE),
                        r.get(SIGNALS.COMPUTED_AT)));
    }

    public record Row(LocalDate signalDate, String categoryId, SignalType signalType, BigDecimal value) {}

    public record HistoryRow(LocalDate signalDate, SignalType signalType, BigDecimal value, OffsetDateTime computedAt) {}
}

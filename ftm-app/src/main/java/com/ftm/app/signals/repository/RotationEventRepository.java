package com.ftm.app.signals.repository;

import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.RotationEvent;
import com.ftm.app.domain.RotationEventType;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

import static com.ftm.app.jooq.Tables.ROTATION_EVENTS;

@Repository
public class RotationEventRepository {

    private final DSLContext dsl;

    public RotationEventRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void insert(RotationEvent event) {
        dsl.insertInto(ROTATION_EVENTS,
                ROTATION_EVENTS.DETECTED_DATE,
                ROTATION_EVENTS.CATEGORY_ID,
                ROTATION_EVENTS.EVENT_TYPE,
                ROTATION_EVENTS.CONFIDENCE,
                ROTATION_EVENTS.SIGNAL_SNAPSHOT,
                ROTATION_EVENTS.NOTES)
                .values(
                        event.detectedDate(),
                        event.categoryId().name(),
                        event.eventType().name(),
                        event.confidence(),
                        JSONB.valueOf(event.signalSnapshot()),
                        event.notes())
                .execute();
    }

    public boolean existsForDateAndType(LocalDate detectedDate, String categoryId, RotationEventType eventType) {
        return dsl.fetchExists(ROTATION_EVENTS,
                ROTATION_EVENTS.DETECTED_DATE.eq(detectedDate)
                        .and(ROTATION_EVENTS.CATEGORY_ID.eq(categoryId))
                        .and(ROTATION_EVENTS.EVENT_TYPE.eq(eventType.name())));
    }

    public List<RotationEvent> findRecentEvents(LocalDate from) {
        return dsl.selectFrom(ROTATION_EVENTS)
                .where(ROTATION_EVENTS.DETECTED_DATE.ge(from))
                .orderBy(ROTATION_EVENTS.DETECTED_DATE.desc(), ROTATION_EVENTS.EVENT_TYPE.asc())
                .fetch()
                .map(r -> new RotationEvent(
                        r.getId(),
                        r.getDetectedDate(),
                        CategoryId.valueOf(r.getCategoryId()),
                        RotationEventType.valueOf(r.getEventType()),
                        r.getConfidence(),
                        r.getSignalSnapshot() == null ? "{}" : r.getSignalSnapshot().data(),
                        r.getNotes()));
    }
}

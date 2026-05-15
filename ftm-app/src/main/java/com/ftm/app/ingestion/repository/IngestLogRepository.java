package com.ftm.app.ingestion.repository;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import org.jooq.DSLContext;
import org.jooq.JSONB;
import org.jooq.Record;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static com.ftm.app.jooq.Tables.INGEST_LOG;

@Repository
public class IngestLogRepository {

    private final DSLContext dsl;

    public IngestLogRepository(DSLContext dsl) {
        this.dsl = dsl;
    }

    public void insert(IngestLog log) {
        dsl.insertInto(INGEST_LOG)
                .set(INGEST_LOG.RUN_ID, log.runId())
                .set(INGEST_LOG.STARTED_AT, log.startedAt())
                .set(INGEST_LOG.STATUS, log.status().name())
                .set(INGEST_LOG.ROWS_INSERTED, log.rowsInserted())
                .set(INGEST_LOG.SOURCE, log.source().name())
                .execute();
    }

    public void update(IngestLog log) {
        dsl.update(INGEST_LOG)
                .set(INGEST_LOG.FINISHED_AT, log.finishedAt())
                .set(INGEST_LOG.STATUS, log.status().name())
                .set(INGEST_LOG.ROWS_INSERTED, log.rowsInserted())
                .set(INGEST_LOG.ERRORS, log.errors() != null ? JSONB.valueOf(log.errors()) : null)
                .where(INGEST_LOG.RUN_ID.eq(log.runId()))
                .execute();
    }

    public Optional<IngestLog> findById(UUID runId) {
        return dsl.selectFrom(INGEST_LOG)
                .where(INGEST_LOG.RUN_ID.eq(runId))
                .fetchOptional()
                .map(this::toIngestLog);
    }

    public Optional<IngestLog> findTopBySourceOrderByStartedAtDesc(IngestSource source) {
        return dsl.selectFrom(INGEST_LOG)
                .where(INGEST_LOG.SOURCE.eq(source.name()))
                .orderBy(INGEST_LOG.STARTED_AT.desc())
                .limit(1)
                .fetchOptional()
                .map(this::toIngestLog);
    }

    public List<IngestLog> findLatestPerSource() {
        var i2 = INGEST_LOG.as("i2");
        return dsl.selectFrom(INGEST_LOG)
                .where(INGEST_LOG.STARTED_AT.eq(
                        dsl.select(i2.STARTED_AT.max()).from(i2)
                                .where(i2.SOURCE.eq(INGEST_LOG.SOURCE))
                ))
                .fetch()
                .map(this::toIngestLog);
    }

    private IngestLog toIngestLog(Record r) {
        var rec = r.into(INGEST_LOG);
        return new IngestLog(
                rec.getRunId(),
                rec.getStartedAt(),
                rec.getFinishedAt(),
                IngestStatus.valueOf(rec.getStatus()),
                rec.getRowsInserted(),
                rec.getErrors() != null ? rec.getErrors().data() : null,
                IngestSource.valueOf(rec.getSource())
        );
    }
}

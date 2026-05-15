package com.ftm.app.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.PositiveOrZero;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "ingest_log")
public class IngestLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "run_id")
    private UUID runId;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt;

    @Column(name = "finished_at")
    private OffsetDateTime finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private IngestStatus status;

    @PositiveOrZero
    @Column(name = "rows_inserted", nullable = false)
    private Integer rowsInserted;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "errors", columnDefinition = "jsonb")
    private String errors;

    @Enumerated(EnumType.STRING)
    @Column(name = "source", nullable = false, length = 10)
    private IngestSource source;

    protected IngestLog() {}

    public IngestLog(OffsetDateTime startedAt, IngestStatus status, Integer rowsInserted, IngestSource source) {
        this.startedAt = startedAt;
        this.status = status;
        this.rowsInserted = rowsInserted;
        this.source = source;
    }

    public UUID getRunId() { return runId; }
    public OffsetDateTime getStartedAt() { return startedAt; }
    public OffsetDateTime getFinishedAt() { return finishedAt; }
    public IngestStatus getStatus() { return status; }
    public Integer getRowsInserted() { return rowsInserted; }
    public String getErrors() { return errors; }
    public IngestSource getSource() { return source; }

    public void finish(OffsetDateTime finishedAt, IngestStatus status, Integer rowsInserted, String errors) {
        this.finishedAt = finishedAt;
        this.status = status;
        this.rowsInserted = rowsInserted;
        this.errors = errors;
    }
}

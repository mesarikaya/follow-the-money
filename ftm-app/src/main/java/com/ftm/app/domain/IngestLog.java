package com.ftm.app.domain;

import java.time.OffsetDateTime;
import java.util.UUID;

public record IngestLog(
        UUID runId,
        OffsetDateTime startedAt,
        OffsetDateTime finishedAt,
        IngestStatus status,
        Integer rowsInserted,
        String errors,
        IngestSource source
) {
    public IngestLog(OffsetDateTime startedAt, IngestStatus status, Integer rowsInserted, IngestSource source) {
        this(UUID.randomUUID(), startedAt, null, status, rowsInserted, null, source);
    }

    public IngestLog finish(OffsetDateTime finishedAt, IngestStatus status, Integer rowsInserted, String errors) {
        return new IngestLog(runId, startedAt, finishedAt, status, rowsInserted, errors, source);
    }
}

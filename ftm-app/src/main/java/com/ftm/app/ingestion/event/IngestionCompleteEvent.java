package com.ftm.app.ingestion.event;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import java.util.UUID;

public record IngestionCompleteEvent(UUID runId, IngestSource source, IngestStatus status) {}

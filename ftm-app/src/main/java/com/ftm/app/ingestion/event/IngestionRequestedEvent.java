package com.ftm.app.ingestion.event;

import com.ftm.app.domain.IngestSource;

public record IngestionRequestedEvent(IngestSource source) {}

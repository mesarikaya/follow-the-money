package com.ftm.app.ingestion.service;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class IngestTriggerService {

    private final IngestLogRepository ingestLogRepository;
    private final ApplicationEventPublisher eventPublisher;

    public IngestTriggerService(IngestLogRepository ingestLogRepository,
                                ApplicationEventPublisher eventPublisher) {
        this.ingestLogRepository = ingestLogRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public IngestTriggerResponse trigger() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.PRICES);
        ingestLogRepository.save(log);
        eventPublisher.publishEvent(new IngestionRequestedEvent(IngestSource.PRICES));
        return new IngestTriggerResponse(
                log.getRunId(),
                "QUEUED",
                "Ingestion started. Poll /api/v1/ingest/status/" + log.getRunId() + " for progress."
        );
    }

    @Transactional(readOnly = true)
    public IngestStatusResponse getStatus(UUID runId) {
        IngestLog log = ingestLogRepository.findById(runId)
                .orElseThrow(() -> new NoSuchElementException("Ingest run not found: " + runId));
        return toResponse(log);
    }

    @Transactional(readOnly = true)
    public List<IngestStatusResponse> getLatestPerSource() {
        return ingestLogRepository.findLatestPerSource()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private IngestStatusResponse toResponse(IngestLog log) {
        return new IngestStatusResponse(
                log.getRunId(),
                log.getSource().name(),
                log.getStatus().name(),
                log.getStartedAt(),
                log.getFinishedAt(),
                log.getRowsInserted()
        );
    }
}

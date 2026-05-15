package com.ftm.app.ingestion.service;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
public class IngestTriggerService {

    private static final Logger log = LoggerFactory.getLogger(IngestTriggerService.class);

    private final IngestLogRepository ingestLogRepository;
    private final ApplicationEventPublisher eventPublisher;

    public IngestTriggerService(IngestLogRepository ingestLogRepository,
                                ApplicationEventPublisher eventPublisher) {
        this.ingestLogRepository = ingestLogRepository;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public IngestTriggerResponse trigger() {
        OffsetDateTime now = OffsetDateTime.now();
        log.info("Ingestion trigger received — queuing PRICES and MACRO");
        // PRICES handler runs flow estimation inline; FLOWS is not a separate event
        List<UUID> runIds = List.of(IngestSource.PRICES, IngestSource.MACRO).stream()
                .map(source -> {
                    IngestLog ingestLog = new IngestLog(now, IngestStatus.RUNNING, 0, source);
                    ingestLogRepository.insert(ingestLog);
                    eventPublisher.publishEvent(new IngestionRequestedEvent(source));
                    log.info("Queued {} ingestion run {}", source, ingestLog.runId());
                    return ingestLog.runId();
                })
                .toList();
        return new IngestTriggerResponse(
                runIds,
                "queued",
                "Ingestion started for PRICES and MACRO. Poll /api/v1/ingest/status/latest for progress."
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
                log.runId(),
                log.source().name().toLowerCase(),
                log.status().name().toLowerCase(),
                log.startedAt(),
                log.finishedAt(),
                log.rowsInserted()
        );
    }
}

package com.ftm.app.ingestion.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.function.Function;

@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    private final PricesIngestionHandler pricesHandler;
    private final MacroIngestionHandler macroHandler;
    private final IngestLogRepository ingestLogRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    public IngestionService(PricesIngestionHandler pricesHandler,
                            MacroIngestionHandler macroHandler,
                            IngestLogRepository ingestLogRepository,
                            ApplicationEventPublisher eventPublisher,
                            ObjectMapper objectMapper) {
        this.pricesHandler = pricesHandler;
        this.macroHandler = macroHandler;
        this.ingestLogRepository = ingestLogRepository;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    @EventListener(condition = "#event.source().name() == 'PRICES'")
    @Async("asyncExecutor")
    @Transactional
    public void onPricesRequested(IngestionRequestedEvent event) {
        runIngestion(IngestSource.PRICES, pricesHandler::fetchAndPersist);
    }

    @EventListener(condition = "#event.source().name() == 'MACRO'")
    @Async("asyncExecutor")
    @Transactional
    public void onMacroRequested(IngestionRequestedEvent event) {
        runIngestion(IngestSource.MACRO, macroHandler::fetchAndPersist);
    }

    private void runIngestion(IngestSource source, Function<LocalDate, IngestionResult> handler) {
        IngestLog ingestLog = findRunningLog(source);
        if (ingestLog == null) {
            log.warn("No running ingest log found for source {}", source);
            return;
        }
        try {
            IngestionResult result = handler.apply(LocalDate.now());
            IngestStatus status = result.hasErrors() ? IngestStatus.PARTIAL : IngestStatus.SUCCESS;
            String errorsJson = result.hasErrors() ? toJson(result.errors()) : null;
            finishAndPublish(ingestLog, source, status, result.rowsInserted(), errorsJson);
            log.info("{} ingestion complete: {} rows, {} errors", source, result.rowsInserted(), result.errors().size());
        } catch (Exception ex) {
            log.error("{} ingestion failed", source, ex);
            finishAndPublish(ingestLog, source, IngestStatus.FAILED, 0, toJson(ex.getMessage()));
        }
    }

    private IngestLog findRunningLog(IngestSource source) {
        return ingestLogRepository.findTopBySourceOrderByStartedAtDesc(source)
                .filter(l -> l.getStatus() == IngestStatus.RUNNING)
                .orElse(null);
    }

    private void finishAndPublish(IngestLog ingestLog, IngestSource source,
                                  IngestStatus status, int rows, String errorsJson) {
        ingestLog.finish(OffsetDateTime.now(), status, rows, errorsJson);
        ingestLogRepository.save(ingestLog);
        eventPublisher.publishEvent(new IngestionCompleteEvent(ingestLog.getRunId(), source, status));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            return "[\"serialization error\"]";
        }
    }
}

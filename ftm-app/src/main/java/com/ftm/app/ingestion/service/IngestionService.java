package com.ftm.app.ingestion.service;

import tools.jackson.databind.json.JsonMapper;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.function.Function;

@Service
public class IngestionService {

    private static final Logger log = LoggerFactory.getLogger(IngestionService.class);

    private final PricesIngestionHandler pricesHandler;
    private final MacroIngestionHandler macroHandler;
    private final IngestLogService ingestLogService;
    private final ApplicationEventPublisher eventPublisher;
    private final JsonMapper objectMapper;

    public IngestionService(PricesIngestionHandler pricesHandler,
                            MacroIngestionHandler macroHandler,
                            IngestLogService ingestLogService,
                            ApplicationEventPublisher eventPublisher,
                            JsonMapper objectMapper) {
        this.pricesHandler = pricesHandler;
        this.macroHandler = macroHandler;
        this.ingestLogService = ingestLogService;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, condition = "#event.source().name() == 'PRICES'")
    @Async("asyncExecutor")
    public void onPricesRequested(IngestionRequestedEvent event) {
        runIngestion(IngestSource.PRICES, pricesHandler::fetchAndPersist);
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, condition = "#event.source().name() == 'MACRO'")
    @Async("asyncExecutor")
    public void onMacroRequested(IngestionRequestedEvent event) {
        runIngestion(IngestSource.MACRO, macroHandler::fetchAndPersist);
    }

    private void runIngestion(IngestSource source, Function<LocalDate, IngestionResult> handler) {
        IngestLog ingestLog = ingestLogService.findRunningLog(source).orElse(null);
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

    private void finishAndPublish(IngestLog ingestLog, IngestSource source,
                                  IngestStatus status, int rows, String errorsJson) {
        ingestLogService.finish(ingestLog, status, rows, errorsJson);
        eventPublisher.publishEvent(new IngestionCompleteEvent(ingestLog.getRunId(), source, status));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            return "[\"serialization error\"]";
        }
    }
}

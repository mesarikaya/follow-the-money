package com.ftm.app.signals.service;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class SignalComputationListener {

    private static final Logger log = LoggerFactory.getLogger(SignalComputationListener.class);

    private final SignalComputationService computationService;

    public SignalComputationListener(SignalComputationService computationService) {
        this.computationService = computationService;
    }

    @EventListener
    @Async("asyncExecutor")
    public void onIngestionComplete(IngestionCompleteEvent event) {
        if (event.source() != IngestSource.PRICES || event.status() == IngestStatus.FAILED) {
            return;
        }
        log.info("Prices ingestion complete (runId={}); triggering signal computation", event.runId());
        computationService.computeAndStore();
    }
}

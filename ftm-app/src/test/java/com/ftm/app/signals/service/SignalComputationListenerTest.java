package com.ftm.app.signals.service;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SignalComputationListenerTest {

    @Mock SignalComputationService computationService;

    @InjectMocks SignalComputationListener listener;

    @Test
    @DisplayName("PRICES SUCCESS triggers signal computation")
    void shouldTriggerComputationOnPricesSuccess() {
        var event = new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.PRICES, IngestStatus.SUCCESS);

        listener.onIngestionComplete(event);

        verify(computationService).computeAndStore();
    }

    @Test
    @DisplayName("PRICES PARTIAL triggers signal computation")
    void shouldTriggerComputationOnPricesPartial() {
        var event = new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.PRICES, IngestStatus.PARTIAL);

        listener.onIngestionComplete(event);

        verify(computationService).computeAndStore();
    }

    @Test
    @DisplayName("PRICES FAILED does not trigger computation")
    void shouldNotTriggerComputationOnPricesFailed() {
        var event = new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.PRICES, IngestStatus.FAILED);

        listener.onIngestionComplete(event);

        verifyNoInteractions(computationService);
    }

    @Test
    @DisplayName("MACRO SUCCESS does not trigger signal computation")
    void shouldNotTriggerComputationOnMacroEvent() {
        var event = new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.MACRO, IngestStatus.SUCCESS);

        listener.onIngestionComplete(event);

        verifyNoInteractions(computationService);
    }
}

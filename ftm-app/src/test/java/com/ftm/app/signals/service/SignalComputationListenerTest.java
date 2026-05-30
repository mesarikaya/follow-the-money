package com.ftm.app.signals.service;

import static org.instancio.Select.field;
import static org.mockito.Mockito.*;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SignalComputationListenerTest {

  @Mock SignalComputationService computationService;

  @InjectMocks SignalComputationListener listener;

  private IngestionCompleteEvent ingestionEvent(IngestSource source, IngestStatus status) {
    return Instancio.of(IngestionCompleteEvent.class)
        .set(field(IngestionCompleteEvent::source), source)
        .set(field(IngestionCompleteEvent::status), status)
        .create();
  }

  @Test
  @DisplayName("PRICES SUCCESS triggers signal computation")
  void shouldTriggerComputationOnPricesSuccess() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.PRICES, IngestStatus.SUCCESS));
    verify(computationService).computeAndStore();
  }

  @Test
  @DisplayName("PRICES PARTIAL triggers signal computation")
  void shouldTriggerComputationOnPricesPartial() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.PRICES, IngestStatus.PARTIAL));
    verify(computationService).computeAndStore();
  }

  @Test
  @DisplayName("PRICES FAILED does not trigger computation")
  void shouldNotTriggerComputationOnPricesFailed() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.PRICES, IngestStatus.FAILED));
    verifyNoInteractions(computationService);
  }

  @Test
  @DisplayName("MACRO SUCCESS does not trigger signal computation")
  void shouldNotTriggerComputationOnMacroEvent() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.SUCCESS));
    verifyNoInteractions(computationService);
  }
}

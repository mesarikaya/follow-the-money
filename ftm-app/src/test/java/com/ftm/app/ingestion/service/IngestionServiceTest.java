package com.ftm.app.ingestion.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngestionServiceTest {

    @Mock PricesIngestionHandler pricesHandler;
    @Mock MacroIngestionHandler macroHandler;
    @Mock IngestLogService ingestLogService;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock ObjectMapper objectMapper;

    @InjectMocks IngestionService service;

    @Test
    void onPricesRequested_finishesLogAndPublishesCompleteEvent_onSuccess() throws Exception {
        IngestLog log = runningLog(IngestSource.PRICES);
        when(ingestLogService.findRunningLog(IngestSource.PRICES)).thenReturn(Optional.of(log));
        when(pricesHandler.fetchAndPersist(any(LocalDate.class)))
                .thenReturn(IngestionResult.success(100));

        service.onPricesRequested(new IngestionRequestedEvent(IngestSource.PRICES));

        verify(ingestLogService).finish(log, IngestStatus.SUCCESS, 100, null);

        ArgumentCaptor<IngestionCompleteEvent> eventCaptor =
                ArgumentCaptor.forClass(IngestionCompleteEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().source()).isEqualTo(IngestSource.PRICES);
        assertThat(eventCaptor.getValue().status()).isEqualTo(IngestStatus.SUCCESS);
    }

    @Test
    void onMacroRequested_finishesLogWithPartialStatus_whenHandlerReturnsErrors() throws Exception {
        IngestLog log = runningLog(IngestSource.MACRO);
        when(ingestLogService.findRunningLog(IngestSource.MACRO)).thenReturn(Optional.of(log));
        when(macroHandler.fetchAndPersist(any(LocalDate.class)))
                .thenReturn(IngestionResult.partial(5, List.of("T10Y2Y: timeout")));
        when(objectMapper.writeValueAsString(any())).thenReturn("[\"T10Y2Y: timeout\"]");

        service.onMacroRequested(new IngestionRequestedEvent(IngestSource.MACRO));

        verify(ingestLogService).finish(eq(log), eq(IngestStatus.PARTIAL), eq(5), any());
        verify(eventPublisher).publishEvent(any(IngestionCompleteEvent.class));
    }

    @Test
    void onPricesRequested_marksLogFailed_whenHandlerThrows() {
        IngestLog log = runningLog(IngestSource.PRICES);
        when(ingestLogService.findRunningLog(IngestSource.PRICES)).thenReturn(Optional.of(log));
        when(pricesHandler.fetchAndPersist(any(LocalDate.class)))
                .thenThrow(new RuntimeException("Yahoo down"));

        service.onPricesRequested(new IngestionRequestedEvent(IngestSource.PRICES));

        verify(ingestLogService).finish(eq(log), eq(IngestStatus.FAILED), eq(0), any());

        ArgumentCaptor<IngestionCompleteEvent> eventCaptor =
                ArgumentCaptor.forClass(IngestionCompleteEvent.class);
        verify(eventPublisher).publishEvent(eventCaptor.capture());
        assertThat(eventCaptor.getValue().status()).isEqualTo(IngestStatus.FAILED);
    }

    @Test
    void onPricesRequested_doesNothing_whenNoRunningLogExists() {
        when(ingestLogService.findRunningLog(IngestSource.PRICES)).thenReturn(Optional.empty());

        service.onPricesRequested(new IngestionRequestedEvent(IngestSource.PRICES));

        verify(pricesHandler, never()).fetchAndPersist(any());
        verify(ingestLogService, never()).finish(any(), any(), anyInt(), any());
    }

    private IngestLog runningLog(IngestSource source) {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, source);
        // Simulate a persisted UUID via reflection — or test without UUID assertion
        return log;
    }
}

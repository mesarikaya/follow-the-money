package com.ftm.app.ingestion.service;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class IngestTriggerServiceTest {

    @Mock IngestLogRepository ingestLogRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @InjectMocks IngestTriggerService service;

    @Test
    void trigger_createsRunLogsForPricesAndMacro() {
        when(ingestLogRepository.save(any(IngestLog.class))).thenAnswer(inv -> inv.getArgument(0));

        IngestTriggerResponse response = service.trigger();

        verify(ingestLogRepository, times(2)).save(any(IngestLog.class));
        assertThat(response.runIds()).hasSize(2);
        assertThat(response.status()).isEqualTo("queued");
    }

    @Test
    void trigger_publishesEventsForPricesAndMacro() {
        when(ingestLogRepository.save(any(IngestLog.class))).thenAnswer(inv -> inv.getArgument(0));

        service.trigger();

        ArgumentCaptor<IngestionRequestedEvent> captor =
                ArgumentCaptor.forClass(IngestionRequestedEvent.class);
        verify(eventPublisher, times(2)).publishEvent(captor.capture());

        List<IngestSource> sources = captor.getAllValues().stream()
                .map(IngestionRequestedEvent::source).toList();
        assertThat(sources).containsExactlyInAnyOrder(IngestSource.PRICES, IngestSource.MACRO);
    }

    @Test
    void getStatus_returnsCorrectResponse_forExistingRun() {
        UUID runId = UUID.randomUUID();
        IngestLog log = runningLog(IngestSource.PRICES, runId);
        when(ingestLogRepository.findById(runId)).thenReturn(Optional.of(log));

        IngestStatusResponse response = service.getStatus(runId);

        assertThat(response.source()).isEqualTo("prices");
        assertThat(response.status()).isEqualTo("running");
    }

    @Test
    void getStatus_throwsNoSuchElement_whenRunNotFound() {
        UUID runId = UUID.randomUUID();
        when(ingestLogRepository.findById(runId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getStatus(runId))
                .isInstanceOf(NoSuchElementException.class);
    }

    @Test
    void getLatestPerSource_returnsMappedResponsesForAllFoundLogs() {
        IngestLog pricesLog = runningLog(IngestSource.PRICES, UUID.randomUUID());
        IngestLog macroLog = runningLog(IngestSource.MACRO, UUID.randomUUID());
        when(ingestLogRepository.findLatestPerSource()).thenReturn(List.of(pricesLog, macroLog));

        List<IngestStatusResponse> responses = service.getLatestPerSource();

        assertThat(responses).hasSize(2);
        assertThat(responses).extracting(IngestStatusResponse::source)
                .containsExactlyInAnyOrder("prices", "macro");
    }

    private IngestLog runningLog(IngestSource source, UUID runId) {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, source);
        return log;
    }
}

package com.ftm.app.ingestion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.api.dto.IngestTriggerResponse;
import com.ftm.app.ingestion.mapper.IngestLogMapper;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionRequestedEvent;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

@ExtendWith(MockitoExtension.class)
class IngestTriggerServiceTest {

  @Mock IngestLogRepository ingestLogRepository;
  @Mock ApplicationEventPublisher eventPublisher;
  @Mock IngestLogMapper ingestLogMapper;
  @InjectMocks IngestTriggerService service;

  private IngestLog runningLog(IngestSource source) {
    return Instancio.of(IngestLog.class)
        .set(field(IngestLog::status), IngestStatus.RUNNING)
        .set(field(IngestLog::source), source)
        .set(field(IngestLog::rowsInserted), 0)
        .ignore(field(IngestLog::finishedAt))
        .ignore(field(IngestLog::errors))
        .create();
  }

  @Test
  @DisplayName("trigger creates run logs for both PRICES and MACRO sources")
  void shouldCreateRunLogsForBothSources() {
    IngestTriggerResponse response = service.trigger();

    verify(ingestLogRepository, times(2)).insert(any(IngestLog.class));
    assertThat(response.runIds()).hasSize(2);
    assertThat(response.status()).isEqualTo("queued");
  }

  @Test
  @DisplayName("trigger publishes ingestion events for both PRICES and MACRO sources")
  void shouldPublishEventsForBothSources() {
    service.trigger();

    ArgumentCaptor<IngestionRequestedEvent> captor =
        ArgumentCaptor.forClass(IngestionRequestedEvent.class);
    verify(eventPublisher, times(2)).publishEvent(captor.capture());

    List<IngestSource> sources =
        captor.getAllValues().stream().map(IngestionRequestedEvent::source).toList();
    assertThat(sources).containsExactlyInAnyOrder(IngestSource.PRICES, IngestSource.MACRO);
  }

  @Test
  @DisplayName("getStatus returns correct response for an existing run")
  void shouldReturnCorrectResponseForExistingRun() {
    UUID runId = UUID.randomUUID();
    IngestLog log = runningLog(IngestSource.PRICES);
    IngestStatusResponse expectedResponse =
        Instancio.of(IngestStatusResponse.class)
            .set(field(IngestStatusResponse::source), "prices")
            .set(field(IngestStatusResponse::status), "running")
            .create();
    when(ingestLogRepository.findById(runId)).thenReturn(Optional.of(log));
    when(ingestLogMapper.toResponse(log)).thenReturn(expectedResponse);

    IngestStatusResponse response = service.getStatus(runId);

    assertThat(response.source()).isEqualTo("prices");
    assertThat(response.status()).isEqualTo("running");
  }

  @Test
  @DisplayName("getStatus throws NoSuchElementException when run is not found")
  void shouldThrowNoSuchElementWhenRunNotFound() {
    UUID runId = UUID.randomUUID();
    when(ingestLogRepository.findById(runId)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service.getStatus(runId)).isInstanceOf(NoSuchElementException.class);
  }

  @Test
  @DisplayName("getLatestPerSource returns mapped responses for all found logs")
  void shouldReturnMappedResponsesForAllFoundLogs() {
    IngestLog pricesLog = runningLog(IngestSource.PRICES);
    IngestLog macroLog = runningLog(IngestSource.MACRO);
    IngestStatusResponse pricesResponse =
        Instancio.of(IngestStatusResponse.class)
            .set(field(IngestStatusResponse::source), "prices")
            .create();
    IngestStatusResponse macroResponse =
        Instancio.of(IngestStatusResponse.class)
            .set(field(IngestStatusResponse::source), "macro")
            .create();
    when(ingestLogRepository.findLatestPerSource()).thenReturn(List.of(pricesLog, macroLog));
    when(ingestLogMapper.toResponse(pricesLog)).thenReturn(pricesResponse);
    when(ingestLogMapper.toResponse(macroLog)).thenReturn(macroResponse);

    List<IngestStatusResponse> responses = service.getLatestPerSource();

    assertThat(responses).hasSize(2);
    assertThat(responses)
        .extracting(IngestStatusResponse::source)
        .containsExactlyInAnyOrder("prices", "macro");
  }
}

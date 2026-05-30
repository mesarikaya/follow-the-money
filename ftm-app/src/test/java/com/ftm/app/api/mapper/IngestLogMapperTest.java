package com.ftm.app.api.mapper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;

import com.ftm.app.api.dto.IngestStatusResponse;
import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class IngestLogMapperTest {

  private final IngestLogMapper mapper = new IngestLogMapperImpl();

  @Test
  @DisplayName("maps IngestLog fields and lowercases source and status")
  void shouldMapAllFields() {
    UUID runId = UUID.randomUUID();
    OffsetDateTime startedAt = OffsetDateTime.parse("2025-03-01T08:00:00Z");
    OffsetDateTime finishedAt = OffsetDateTime.parse("2025-03-01T08:05:00Z");
    IngestLog source =
        Instancio.of(IngestLog.class)
            .set(field(IngestLog::runId), runId)
            .set(field(IngestLog::startedAt), startedAt)
            .set(field(IngestLog::finishedAt), finishedAt)
            .set(field(IngestLog::status), IngestStatus.SUCCESS)
            .set(field(IngestLog::rowsInserted), 42)
            .set(field(IngestLog::source), IngestSource.PRICES)
            .create();

    IngestStatusResponse result = mapper.toResponse(source);

    assertThat(result.runId()).isEqualTo(runId);
    assertThat(result.source()).isEqualTo("prices");
    assertThat(result.status()).isEqualTo("success");
    assertThat(result.startedAt()).isEqualTo(startedAt);
    assertThat(result.finishedAt()).isEqualTo(finishedAt);
    assertThat(result.rowsInserted()).isEqualTo(42);
  }

  @Test
  @DisplayName("maps MACRO source and RUNNING status to lowercase")
  void shouldLowercaseMacroAndRunning() {
    IngestLog source =
        Instancio.of(IngestLog.class)
            .set(field(IngestLog::status), IngestStatus.RUNNING)
            .set(field(IngestLog::source), IngestSource.MACRO)
            .ignore(field(IngestLog::finishedAt))
            .create();

    IngestStatusResponse result = mapper.toResponse(source);

    assertThat(result.source()).isEqualTo("macro");
    assertThat(result.status()).isEqualTo("running");
    assertThat(result.finishedAt()).isNull();
  }
}

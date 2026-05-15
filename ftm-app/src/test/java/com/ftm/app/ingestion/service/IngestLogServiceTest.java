package com.ftm.app.ingestion.service;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class IngestLogServiceTest {

    @Autowired IngestLogService ingestLogService;
    @Autowired IngestLogRepository ingestLogRepository;

    @Test
    @DisplayName("findRunningLog returns the latest running log for source")
    void shouldReturnLatestRunningLogForSource() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.PRICES);
        ingestLogRepository.insert(log);

        Optional<IngestLog> found = ingestLogService.findRunningLog(IngestSource.PRICES);

        assertThat(found).isPresent();
        assertThat(found.get().status()).isEqualTo(IngestStatus.RUNNING);
        assertThat(found.get().source()).isEqualTo(IngestSource.PRICES);
    }

    @Test
    @DisplayName("findRunningLog returns empty when log is not in running state")
    void shouldReturnEmptyWhenLogIsNotRunning() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.MACRO);
        ingestLogRepository.insert(log);
        ingestLogService.finish(log, IngestStatus.SUCCESS, 42, null);

        Optional<IngestLog> found = ingestLogService.findRunningLog(IngestSource.MACRO);

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("finish updates status and row count in the database")
    void shouldUpdateStatusAndRowCount() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.PRICES);
        ingestLogRepository.insert(log);

        ingestLogService.finish(log, IngestStatus.SUCCESS, 250, null);

        IngestLog updated = ingestLogRepository.findById(log.runId()).orElseThrow();
        assertThat(updated.status()).isEqualTo(IngestStatus.SUCCESS);
        assertThat(updated.rowsInserted()).isEqualTo(250);
        assertThat(updated.finishedAt()).isNotNull();
    }

    @Test
    @DisplayName("finish persists errors JSON when status is partial")
    void shouldPersistErrorsJsonOnPartialStatus() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.MACRO);
        ingestLogRepository.insert(log);

        ingestLogService.finish(log, IngestStatus.PARTIAL, 5, "[\"T10Y2Y: timeout\"]");

        IngestLog updated = ingestLogRepository.findById(log.runId()).orElseThrow();
        assertThat(updated.status()).isEqualTo(IngestStatus.PARTIAL);
        assertThat(updated.errors()).contains("T10Y2Y");
    }
}

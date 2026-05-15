package com.ftm.app.ingestion.service;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.repository.IngestLogRepository;
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
    void findRunningLog_returnsLatestRunningLogForSource() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.PRICES);
        ingestLogRepository.save(log);

        Optional<IngestLog> found = ingestLogService.findRunningLog(IngestSource.PRICES);

        assertThat(found).isPresent();
        assertThat(found.get().getStatus()).isEqualTo(IngestStatus.RUNNING);
        assertThat(found.get().getSource()).isEqualTo(IngestSource.PRICES);
    }

    @Test
    void findRunningLog_returnsEmptyWhenLogIsNotRunning() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.MACRO);
        ingestLogRepository.save(log);
        ingestLogService.finish(log, IngestStatus.SUCCESS, 42, null);

        Optional<IngestLog> found = ingestLogService.findRunningLog(IngestSource.MACRO);

        assertThat(found).isEmpty();
    }

    @Test
    void finish_updatesStatusAndRowCount() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.PRICES);
        ingestLogRepository.save(log);

        ingestLogService.finish(log, IngestStatus.SUCCESS, 250, null);

        IngestLog updated = ingestLogRepository.findById(log.getRunId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(IngestStatus.SUCCESS);
        assertThat(updated.getRowsInserted()).isEqualTo(250);
        assertThat(updated.getFinishedAt()).isNotNull();
    }

    @Test
    void finish_persistsErrorsJson_onPartialStatus() {
        IngestLog log = new IngestLog(OffsetDateTime.now(), IngestStatus.RUNNING, 0, IngestSource.MACRO);
        ingestLogRepository.save(log);

        ingestLogService.finish(log, IngestStatus.PARTIAL, 5, "[\"T10Y2Y: timeout\"]");

        IngestLog updated = ingestLogRepository.findById(log.getRunId()).orElseThrow();
        assertThat(updated.getStatus()).isEqualTo(IngestStatus.PARTIAL);
        assertThat(updated.getErrors()).contains("T10Y2Y");
    }
}

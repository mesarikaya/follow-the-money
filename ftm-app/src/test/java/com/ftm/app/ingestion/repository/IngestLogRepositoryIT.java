package com.ftm.app.ingestion.repository;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import org.instancio.Instancio;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
class IngestLogRepositoryIT {

    @Autowired
    IngestLogRepository repository;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanTable() {
        jdbcTemplate.execute("TRUNCATE ingest_log CASCADE");
    }

    private IngestLog runningLog(IngestSource source) {
        return runningLog(source, OffsetDateTime.now());
    }

    private IngestLog runningLog(IngestSource source, OffsetDateTime startedAt) {
        return Instancio.of(IngestLog.class)
                .set(field(IngestLog::startedAt), startedAt)
                .set(field(IngestLog::status), IngestStatus.RUNNING)
                .set(field(IngestLog::source), source)
                .set(field(IngestLog::rowsInserted), 0)
                .ignore(field(IngestLog::finishedAt))
                .ignore(field(IngestLog::errors))
                .create();
    }

    @Test
    @DisplayName("insert persists a new log with running status")
    void shouldPersistLog() {
        var log = runningLog(IngestSource.PRICES);

        repository.insert(log);

        var found = repository.findById(log.runId());
        assertThat(found).isPresent();
        assertThat(found.get().status()).isEqualTo(IngestStatus.RUNNING);
        assertThat(found.get().source()).isEqualTo(IngestSource.PRICES);
        assertThat(found.get().rowsInserted()).isZero();
        assertThat(found.get().finishedAt()).isNull();
    }

    @Test
    @DisplayName("findById returns empty for unknown id")
    void shouldReturnEmptyForUnknownId() {
        var found = repository.findById(UUID.randomUUID());

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("update persists finished state with success status")
    void shouldPersistFinishedState() {
        var log = runningLog(IngestSource.MACRO);
        repository.insert(log);

        repository.update(log.finish(OffsetDateTime.now(), IngestStatus.SUCCESS, 42, null));

        var updated = repository.findById(log.runId()).orElseThrow();
        assertThat(updated.status()).isEqualTo(IngestStatus.SUCCESS);
        assertThat(updated.rowsInserted()).isEqualTo(42);
        assertThat(updated.finishedAt()).isNotNull();
        assertThat(updated.errors()).isNull();
    }

    @Test
    @DisplayName("update persists errors JSON on partial status")
    void shouldPersistErrorsJson() {
        var log = runningLog(IngestSource.PRICES);
        repository.insert(log);

        repository.update(log.finish(OffsetDateTime.now(), IngestStatus.PARTIAL, 5, "[\"T10Y2Y: timeout\"]"));

        var updated = repository.findById(log.runId()).orElseThrow();
        assertThat(updated.status()).isEqualTo(IngestStatus.PARTIAL);
        assertThat(updated.errors()).contains("T10Y2Y");
    }

    @Test
    @DisplayName("findTopBySourceOrderByStartedAtDesc returns the most recent log for source")
    void shouldReturnLatestLogForSource() {
        var older = runningLog(IngestSource.PRICES, OffsetDateTime.now().minusHours(1));
        var newer = runningLog(IngestSource.PRICES, OffsetDateTime.now());
        repository.insert(older);
        repository.insert(newer);

        var found = repository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES);

        assertThat(found).isPresent();
        assertThat(found.get().runId()).isEqualTo(newer.runId());
    }

    @Test
    @DisplayName("findTopBySourceOrderByStartedAtDesc isolates results per source")
    void shouldIsolateLatestLogPerSource() {
        repository.insert(runningLog(IngestSource.PRICES));
        repository.insert(runningLog(IngestSource.MACRO));

        assertThat(repository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES).get().source())
                .isEqualTo(IngestSource.PRICES);
        assertThat(repository.findTopBySourceOrderByStartedAtDesc(IngestSource.MACRO).get().source())
                .isEqualTo(IngestSource.MACRO);
    }

    @Test
    @DisplayName("findTopBySourceOrderByStartedAtDesc returns empty when no records exist")
    void shouldReturnEmptyWhenNoRecordsExist() {
        var found = repository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES);

        assertThat(found).isEmpty();
    }

    @Test
    @DisplayName("findLatestPerSource returns one log per source")
    void shouldReturnOneLogPerSource() {
        var prices1 = runningLog(IngestSource.PRICES, OffsetDateTime.now().minusHours(2));
        var prices2 = runningLog(IngestSource.PRICES, OffsetDateTime.now());
        var macro = runningLog(IngestSource.MACRO, OffsetDateTime.now().minusHours(1));
        repository.insert(prices1);
        repository.insert(prices2);
        repository.insert(macro);

        List<IngestLog> latest = repository.findLatestPerSource();

        assertThat(latest).hasSize(2);
        assertThat(latest).extracting(IngestLog::source)
                .containsExactlyInAnyOrder(IngestSource.PRICES, IngestSource.MACRO);
        assertThat(latest.stream().filter(l -> l.source() == IngestSource.PRICES).findFirst().orElseThrow().runId())
                .isEqualTo(prices2.runId());
    }

    @Test
    @DisplayName("findLatestPerSource returns empty when table is empty")
    void shouldReturnEmptyWhenTableIsEmpty() {
        assertThat(repository.findLatestPerSource()).isEmpty();
    }
}

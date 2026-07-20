package com.ftm.app.ingestion.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class IngestionCatchUpRunnerTest {

  @Mock IngestLogRepository ingestLogRepository;
  @Mock IngestTriggerService ingestTriggerService;

  private IngestionCatchUpRunner runner() {
    return new IngestionCatchUpRunner(ingestLogRepository, ingestTriggerService);
  }

  private void lastPriceRunAt(OffsetDateTime startedAt) {
    when(ingestLogRepository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES))
        .thenReturn(
            Optional.of(
                new IngestLog(startedAt, IngestStatus.SUCCESS, 0, IngestSource.PRICES)));
  }

  @Test
  @DisplayName("ingests when prices are older than a day — the missed-schedule case")
  void shouldIngestWhenStale() {
    lastPriceRunAt(OffsetDateTime.now().minusDays(7));

    runner().run(null);

    verify(ingestTriggerService).trigger();
  }

  @Test
  @DisplayName("does not ingest when prices are fresh — a restart mid-session must not re-fetch")
  void shouldSkipWhenFresh() {
    lastPriceRunAt(OffsetDateTime.now().minusHours(2));

    runner().run(null);

    verify(ingestTriggerService, never()).trigger();
  }

  @Test
  @DisplayName("ingests on a database that has never ingested")
  void shouldIngestWhenNoPriceRunExists() {
    when(ingestLogRepository.findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES))
        .thenReturn(Optional.empty());

    runner().run(null);

    verify(ingestTriggerService).trigger();
  }

  @Test
  @DisplayName("judges staleness on PRICES, not on whichever source ran most recently")
  void shouldIgnoreOtherSources() {
    // Macro ingesting fine while prices sit a week behind is exactly the case that must still
    // trigger — the signals are built from prices.
    lastPriceRunAt(OffsetDateTime.now().minusDays(7));

    runner().run(null);

    verify(ingestLogRepository).findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES);
    verify(ingestLogRepository, never()).findTopBySourceOrderByStartedAtDesc(IngestSource.MACRO);
    verify(ingestTriggerService).trigger();
  }
}

package com.ftm.app.ingestion.service;

import com.ftm.app.domain.IngestLog;
import com.ftm.app.domain.IngestSource;
import com.ftm.app.ingestion.repository.IngestLogRepository;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * Ingests once on startup when the stored data has gone stale.
 *
 * <p>{@link IngestionScheduler} is the only other trigger, and it fires at 16:30 ET on weekdays —
 * which only happens if the process is up at that exact moment. Run on a laptop, it usually is not:
 * across 2026-05-17 to 2026-07-18 the app ingested on 18 days out of ~62, in clusters, with 7- and
 * 8-day gaps. A missed day is never backfilled, so prices, macro and every signal derived from them
 * quietly drift while the app looks perfectly healthy.
 *
 * <p>Starting the app is the one moment we know the process is alive, so it is the natural place to
 * catch up.
 *
 * <p><b>Local profile only, deliberately.</b> CI's real-backend E2E job boots the jar with no
 * profile and no FRED key, on a runner that cannot reach the market APIs — an ingestion attempt
 * there would be slow noise at best. The {@code local} profile is exactly "someone's machine with
 * credentials", which is where catching up makes sense.
 */
@Component
@Profile("local")
public class IngestionCatchUpRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(IngestionCatchUpRunner.class);

  /**
   * A day, so a restart during a working session does not re-ingest what the previous start already
   * fetched. Prices only change once per trading day, so anything finer is wasted API calls.
   */
  static final Duration STALE_AFTER = Duration.ofHours(24);

  private final IngestLogRepository ingestLogRepository;
  private final IngestTriggerService ingestTriggerService;

  public IngestionCatchUpRunner(
      IngestLogRepository ingestLogRepository, IngestTriggerService ingestTriggerService) {
    this.ingestLogRepository = ingestLogRepository;
    this.ingestTriggerService = ingestTriggerService;
  }

  @Override
  public void run(ApplicationArguments args) {
    Optional<OffsetDateTime> lastRun = lastPriceIngestStartedAt();

    if (lastRun.isPresent() && !isStale(lastRun.get())) {
      log.info("Startup ingestion skipped — prices last ingested at {}", lastRun.get());
      return;
    }

    log.info(
        "Startup ingestion triggered — prices last ingested {}",
        lastRun.map(OffsetDateTime::toString).orElse("never"));
    ingestTriggerService.trigger();
  }

  /**
   * Anchored on PRICES rather than the newest run of any source: macro can succeed while prices are
   * days behind, and prices are what the signals are built from.
   */
  private Optional<OffsetDateTime> lastPriceIngestStartedAt() {
    return ingestLogRepository
        .findTopBySourceOrderByStartedAtDesc(IngestSource.PRICES)
        .map(IngestLog::startedAt);
  }

  private boolean isStale(OffsetDateTime lastRunStartedAt) {
    return Duration.between(lastRunStartedAt, OffsetDateTime.now()).compareTo(STALE_AFTER) > 0;
  }
}

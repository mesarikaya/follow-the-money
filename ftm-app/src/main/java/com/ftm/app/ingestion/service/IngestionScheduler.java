package com.ftm.app.ingestion.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class IngestionScheduler {

  private static final Logger log = LoggerFactory.getLogger(IngestionScheduler.class);

  private final IngestTriggerService ingestTriggerService;

  public IngestionScheduler(IngestTriggerService ingestTriggerService) {
    this.ingestTriggerService = ingestTriggerService;
  }

  // Market close + 30 min buffer, weekdays only (Eastern Time)
  @Scheduled(cron = "0 30 16 * * MON-FRI", zone = "America/New_York")
  public void runDailyIngestion() {
    log.info("Scheduled daily ingestion triggered");
    ingestTriggerService.trigger();
  }
}

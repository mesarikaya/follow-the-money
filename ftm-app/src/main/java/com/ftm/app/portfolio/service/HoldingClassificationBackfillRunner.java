package com.ftm.app.portfolio.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Backfills the category of holdings that were uploaded before their ticker→category mapping
 * existed. Such holdings persist a {@code null} category_id and would otherwise display as
 * "Unclassified" indefinitely — even after a later Flyway migration adds the mapping — because
 * classification is resolved and stored at upload time, not on read.
 *
 * <p>Running once the application is ready (the classification cache is already loaded by then)
 * lets newly-mapped tickers self-heal on the next startup, so a schema update that adds mappings
 * is enough to fix existing portfolios without a manual refresh.
 */
@Component
public class HoldingClassificationBackfillRunner {

  private static final Logger log =
      LoggerFactory.getLogger(HoldingClassificationBackfillRunner.class);

  private final HoldingUploadService holdingUploadService;

  public HoldingClassificationBackfillRunner(HoldingUploadService holdingUploadService) {
    this.holdingUploadService = holdingUploadService;
  }

  @EventListener(ApplicationReadyEvent.class)
  public void resyncHoldingCategoriesOnStartup() {
    int reclassified = holdingUploadService.resyncHoldingCategories();
    if (reclassified > 0) {
      log.info(
          "Startup backfill re-synced {} holding(s) whose category differed from the current"
              + " ticker→category map",
          reclassified);
    }
  }
}

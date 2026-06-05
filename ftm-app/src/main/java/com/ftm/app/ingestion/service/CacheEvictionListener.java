package com.ftm.app.ingestion.service;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.CacheManager;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
public class CacheEvictionListener {

  private static final Logger log = LoggerFactory.getLogger(CacheEvictionListener.class);

  private final CacheManager cacheManager;

  public CacheEvictionListener(CacheManager cacheManager) {
    this.cacheManager = cacheManager;
  }

  @EventListener
  @Async("asyncExecutor")
  public void onIngestionComplete(IngestionCompleteEvent event) {
    if (event.status() == IngestStatus.FAILED) {
      return;
    }
    if (event.source() == IngestSource.MACRO) {
      evict("macro-latest");
    }
  }

  @EventListener
  @Async("asyncExecutor")
  public void onSignalsUpdated(SignalsUpdatedEvent event) {
    evict("signals-latest");
    evict("rrg-latest");
    evict("rotation-latest");
    evict("sub-sectors-latest");
    evict("transitions-latest");
    evict("score-percentile-252d");
    evict("signal-days-active");
    evict("price-levels");
    evict("win-rates");
    evict("score-history");
    evict("seasonal-returns");
  }

  private void evict(String cacheName) {
    var cache = cacheManager.getCache(cacheName);
    if (cache != null) {
      cache.clear();
      log.info("Evicted cache '{}'", cacheName);
    }
  }
}

package com.ftm.app.ingestion.service;

import static org.instancio.Select.field;
import static org.mockito.Mockito.*;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import java.time.LocalDate;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

@ExtendWith(MockitoExtension.class)
class CacheEvictionListenerTest {

  @Mock CacheManager cacheManager;
  @Mock Cache macroCache;
  @Mock Cache signalsCache;

  @InjectMocks CacheEvictionListener listener;

  private IngestionCompleteEvent ingestionEvent(IngestSource source, IngestStatus status) {
    return Instancio.of(IngestionCompleteEvent.class)
        .set(field(IngestionCompleteEvent::source), source)
        .set(field(IngestionCompleteEvent::status), status)
        .create();
  }

  @Test
  @DisplayName("MACRO SUCCESS evicts macro-latest and macro-history caches")
  void shouldEvictMacroCachesOnMacroSuccess() {
    Cache macroHistoryCache = mock(Cache.class);
    when(cacheManager.getCache("macro-latest")).thenReturn(macroCache);
    when(cacheManager.getCache("macro-history")).thenReturn(macroHistoryCache);

    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.SUCCESS));

    verify(macroCache).clear();
    verify(macroHistoryCache).clear();
  }

  @Test
  @DisplayName("MACRO PARTIAL evicts macro-latest and macro-history caches")
  void shouldEvictMacroCachesOnMacroPartial() {
    Cache macroHistoryCache = mock(Cache.class);
    when(cacheManager.getCache("macro-latest")).thenReturn(macroCache);
    when(cacheManager.getCache("macro-history")).thenReturn(macroHistoryCache);

    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.PARTIAL));

    verify(macroCache).clear();
    verify(macroHistoryCache).clear();
  }

  @Test
  @DisplayName("MACRO FAILED does not evict any cache")
  void shouldNotEvictCacheOnFailure() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.FAILED));
    verifyNoInteractions(cacheManager);
  }

  @Test
  @DisplayName("PRICES SUCCESS does not evict macro caches")
  void shouldNotEvictMacroCacheOnPricesEvent() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.PRICES, IngestStatus.SUCCESS));
    verifyNoInteractions(cacheManager);
  }

  @Test
  @DisplayName("SignalsUpdatedEvent evicts all signal and alert caches")
  void shouldEvictAllSignalCachesOnSignalsUpdated() {
    var cacheNames =
        java.util.List.of(
            "signals-latest",
            "rrg-latest",
            "rotation-latest",
            "sub-sectors-latest",
            "transitions-latest",
            "score-percentile-252d",
            "signal-days-active",
            "price-levels",
            "win-rates",
            "score-history",
            "seasonal-returns",
            "signal-history",
            "alerts-latest",
            "alerts-count");
    cacheNames.forEach(name -> when(cacheManager.getCache(name)).thenReturn(signalsCache));

    listener.onSignalsUpdated(new SignalsUpdatedEvent(LocalDate.now()));

    verify(signalsCache, times(cacheNames.size())).clear();
  }

  @Test
  @DisplayName("SignalsUpdatedEvent skips null caches gracefully")
  void shouldSkipNullCachesOnSignalsUpdated() {
    when(cacheManager.getCache(anyString())).thenReturn(null);

    listener.onSignalsUpdated(new SignalsUpdatedEvent(LocalDate.now()));

    verify(signalsCache, never()).clear();
  }
}

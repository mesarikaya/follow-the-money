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
  @DisplayName("MACRO SUCCESS evicts macro-latest cache")
  void shouldEvictMacroCacheOnMacroSuccess() {
    when(cacheManager.getCache("macro-latest")).thenReturn(macroCache);
    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.SUCCESS));
    verify(macroCache).clear();
  }

  @Test
  @DisplayName("MACRO PARTIAL evicts macro-latest cache")
  void shouldEvictMacroCacheOnMacroPartial() {
    when(cacheManager.getCache("macro-latest")).thenReturn(macroCache);
    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.PARTIAL));
    verify(macroCache).clear();
  }

  @Test
  @DisplayName("MACRO FAILED does not evict cache")
  void shouldNotEvictCacheOnFailure() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.MACRO, IngestStatus.FAILED));
    verifyNoInteractions(cacheManager);
  }

  @Test
  @DisplayName("PRICES SUCCESS does not evict macro-latest cache")
  void shouldNotEvictMacroCacheOnPricesEvent() {
    listener.onIngestionComplete(ingestionEvent(IngestSource.PRICES, IngestStatus.SUCCESS));
    verifyNoInteractions(cacheManager);
  }

  @Test
  @DisplayName("SignalsUpdatedEvent evicts signals-latest cache")
  void shouldEvictSignalsCacheOnSignalsUpdated() {
    when(cacheManager.getCache("signals-latest")).thenReturn(signalsCache);
    listener.onSignalsUpdated(new SignalsUpdatedEvent(LocalDate.now()));
    verify(signalsCache).clear();
  }
}

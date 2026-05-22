package com.ftm.app.ingestion.service;

import static org.mockito.Mockito.*;

import com.ftm.app.domain.IngestSource;
import com.ftm.app.domain.IngestStatus;
import com.ftm.app.ingestion.event.IngestionCompleteEvent;
import com.ftm.app.signals.event.SignalsUpdatedEvent;
import java.time.LocalDate;
import java.util.UUID;
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

  @Test
  @DisplayName("MACRO SUCCESS evicts macro-latest cache")
  void shouldEvictMacroCacheOnMacroSuccess() {
    when(cacheManager.getCache("macro-latest")).thenReturn(macroCache);
    var event =
        new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.MACRO, IngestStatus.SUCCESS);

    listener.onIngestionComplete(event);

    verify(macroCache).clear();
  }

  @Test
  @DisplayName("MACRO PARTIAL evicts macro-latest cache")
  void shouldEvictMacroCacheOnMacroPartial() {
    when(cacheManager.getCache("macro-latest")).thenReturn(macroCache);
    var event =
        new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.MACRO, IngestStatus.PARTIAL);

    listener.onIngestionComplete(event);

    verify(macroCache).clear();
  }

  @Test
  @DisplayName("MACRO FAILED does not evict cache")
  void shouldNotEvictCacheOnFailure() {
    var event =
        new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.MACRO, IngestStatus.FAILED);

    listener.onIngestionComplete(event);

    verifyNoInteractions(cacheManager);
  }

  @Test
  @DisplayName("PRICES SUCCESS does not evict macro-latest cache")
  void shouldNotEvictMacroCacheOnPricesEvent() {
    var event =
        new IngestionCompleteEvent(UUID.randomUUID(), IngestSource.PRICES, IngestStatus.SUCCESS);

    listener.onIngestionComplete(event);

    verifyNoInteractions(cacheManager);
  }

  @Test
  @DisplayName("SignalsUpdatedEvent evicts signals-latest cache")
  void shouldEvictSignalsCacheOnSignalsUpdated() {
    when(cacheManager.getCache("signals-latest")).thenReturn(signalsCache);
    var event = new SignalsUpdatedEvent(LocalDate.now());

    listener.onSignalsUpdated(event);

    verify(signalsCache).clear();
  }
}

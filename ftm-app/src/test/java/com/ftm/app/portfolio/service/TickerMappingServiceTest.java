package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.ftm.app.category.repository.CategoryRepository;
import com.ftm.app.portfolio.domain.TickerMapping;
import com.ftm.app.portfolio.repository.TickerMappingRepository;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TickerMappingServiceTest {

  @Mock TickerMappingRepository tickerMappingRepository;
  @Mock CategoryRepository categoryRepository;
  @Mock HoldingClassificationService classificationService;
  @Mock HoldingUploadService holdingUploadService;

  private TickerMappingService service() {
    return new TickerMappingService(
        tickerMappingRepository, categoryRepository, classificationService, holdingUploadService);
  }

  @Test
  @DisplayName(
      "upsert with a known category persists, refreshes cache, reclassifies, and returns saved")
  void upsertKnownCategory() {
    when(categoryRepository.existsById("FINL_FINT")).thenReturn(true);
    when(holdingUploadService.resyncHoldingCategories()).thenReturn(1);
    var saved = new TickerMapping("ADYEN.AS", "FINL_FINT", "note", OffsetDateTime.now());
    when(tickerMappingRepository.findByTicker("ADYEN.AS")).thenReturn(Optional.of(saved));

    TickerMapping result = service().upsert("ADYEN.AS", "FINL_FINT", "note");

    assertThat(result).isEqualTo(saved);
    verify(tickerMappingRepository).upsert("ADYEN.AS", "FINL_FINT", "note");
    verify(classificationService).refreshCache();
    verify(holdingUploadService).resyncHoldingCategories();
  }

  @Test
  @DisplayName("upsert with an unknown category throws and never writes the mapping")
  void upsertUnknownCategoryRejected() {
    when(categoryRepository.existsById("NOPE")).thenReturn(false);

    assertThatThrownBy(() -> service().upsert("ZZZZ", "NOPE", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown category");

    verify(tickerMappingRepository, never())
        .upsert(
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.anyString(),
            org.mockito.ArgumentMatchers.any());
    verifyNoInteractions(classificationService, holdingUploadService);
  }

  @Test
  @DisplayName("delete refreshes cache when a mapping was removed")
  void deleteExisting() {
    when(tickerMappingRepository.delete("ADYEN.AS")).thenReturn(1);

    assertThat(service().delete("ADYEN.AS")).isTrue();
    verify(classificationService).refreshCache();
  }

  @Test
  @DisplayName("delete of a missing mapping returns false and does not refresh cache")
  void deleteMissing() {
    when(tickerMappingRepository.delete("NOPE")).thenReturn(0);

    assertThat(service().delete("NOPE")).isFalse();
    verify(classificationService, never()).refreshCache();
  }
}

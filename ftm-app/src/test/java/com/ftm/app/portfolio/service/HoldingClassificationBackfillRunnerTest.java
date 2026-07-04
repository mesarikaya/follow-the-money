package com.ftm.app.portfolio.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HoldingClassificationBackfillRunnerTest {

  @Mock private HoldingUploadService holdingUploadService;

  @InjectMocks private HoldingClassificationBackfillRunner runner;

  @Test
  @DisplayName("re-syncs holding categories when the application is ready")
  void triggersReclassificationOnStartup() {
    when(holdingUploadService.resyncHoldingCategories()).thenReturn(2);

    runner.resyncHoldingCategoriesOnStartup();

    verify(holdingUploadService).resyncHoldingCategories();
  }

  @Test
  @DisplayName("is a no-op observable side effect when nothing needs reclassifying")
  void handlesZeroReclassified() {
    when(holdingUploadService.resyncHoldingCategories()).thenReturn(0);

    runner.resyncHoldingCategoriesOnStartup();

    verify(holdingUploadService).resyncHoldingCategories();
  }
}

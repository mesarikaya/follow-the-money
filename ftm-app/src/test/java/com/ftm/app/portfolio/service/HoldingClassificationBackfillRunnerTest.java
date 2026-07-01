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
  @DisplayName("runs reclassification of unmapped holdings when the application is ready")
  void triggersReclassificationOnStartup() {
    when(holdingUploadService.reclassifyUnmappedHoldings()).thenReturn(2);

    runner.backfillUnclassifiedHoldings();

    verify(holdingUploadService).reclassifyUnmappedHoldings();
  }

  @Test
  @DisplayName("is a no-op observable side effect when nothing needs reclassifying")
  void handlesZeroReclassified() {
    when(holdingUploadService.reclassifyUnmappedHoldings()).thenReturn(0);

    runner.backfillUnclassifiedHoldings();

    verify(holdingUploadService).reclassifyUnmappedHoldings();
  }
}

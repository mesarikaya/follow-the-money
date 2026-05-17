package com.ftm.app.ingestion.service;

import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import com.ftm.app.ingestion.repository.MacroIndicatorRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MacroIngestionHandlerTest {

    @Mock FredClient fredClient;
    @Mock MacroIndicatorRepository macroRepo;

    @InjectMocks MacroIngestionHandler handler;

    @Test
    @DisplayName("fetchAndPersist fetches all nine configured FRED series")
    void shouldFetchAllNineFredSeries() {
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.empty());
        when(fredClient.fetchObservations(anyString(), any(), any())).thenReturn(observations());
        when(macroRepo.batchInsert(any())).thenReturn(2);

        IngestionResult result = handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        // 9 series × 2 rows each (DCOILWTICO added as cross-asset indicator for EP-015)
        assertThat(result.rowsInserted()).isEqualTo(18);
        assertThat(result.hasErrors()).isFalse();
        verify(fredClient, times(9)).fetchObservations(anyString(), any(), any());
    }

    @Test
    @DisplayName("fetchAndPersist uses max observation date for incremental fetch")
    void shouldUseMaxObservationDateForIncrementalFetch() {
        LocalDate lastKnown = LocalDate.of(2024, 1, 2);
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.of(lastKnown));
        when(fredClient.fetchObservations(anyString(), any(), any())).thenReturn(List.of());
        when(macroRepo.batchInsert(any())).thenReturn(0);

        handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        verify(fredClient, atLeastOnce()).fetchObservations(
                anyString(), eq(lastKnown.plusDays(1)), any());
    }

    @Test
    @DisplayName("fetchAndPersist captures per-series errors and returns partial result")
    void shouldCaptureSeriesErrorsAsPartialResult() {
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.empty());
        when(fredClient.fetchObservations(anyString(), any(), any()))
                .thenThrow(new RuntimeException("FRED unavailable"));

        IngestionResult result = handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errors()).hasSize(9);
    }

    @Test
    @DisplayName("fetchAndPersist skips series that are already up to date")
    void shouldSkipSeriesAlreadyUpToDate() {
        LocalDate today = LocalDate.of(2024, 1, 5);
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.of(today));

        IngestionResult result = handler.fetchAndPersist(today);

        assertThat(result.rowsInserted()).isEqualTo(0);
        assertThat(result.hasErrors()).isFalse();
        verifyNoInteractions(fredClient);
    }

    private List<FredObservationsResponse.Observation> observations() {
        return List.of(
                new FredObservationsResponse.Observation("2024-01-02", "3.95"),
                new FredObservationsResponse.Observation("2024-01-04", "3.88")
        );
    }
}

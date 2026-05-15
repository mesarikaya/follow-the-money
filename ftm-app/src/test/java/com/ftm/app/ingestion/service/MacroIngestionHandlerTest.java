package com.ftm.app.ingestion.service;

import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.dto.FredObservationsResponse;
import com.ftm.app.ingestion.repository.MacroIndicatorJdbcRepository;
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
    @Mock MacroIndicatorJdbcRepository macroRepo;

    @InjectMocks MacroIngestionHandler handler;

    @Test
    void fetchAndPersist_fetchesAllSevenFredSeries() {
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.empty());
        when(fredClient.fetchObservations(anyString(), any(), any())).thenReturn(observations());
        when(macroRepo.batchInsert(any())).thenReturn(2);

        IngestionResult result = handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        // 7 series × 2 rows each
        assertThat(result.rowsInserted()).isEqualTo(14);
        assertThat(result.hasErrors()).isFalse();
        verify(fredClient, times(7)).fetchObservations(anyString(), any(), any());
    }

    @Test
    void fetchAndPersist_usesMaxObservationDateForIncrementalFetch() {
        LocalDate lastKnown = LocalDate.of(2024, 1, 2);
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.of(lastKnown));
        when(fredClient.fetchObservations(anyString(), any(), any())).thenReturn(List.of());
        when(macroRepo.batchInsert(any())).thenReturn(0);

        handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        verify(fredClient, atLeastOnce()).fetchObservations(
                anyString(), eq(lastKnown.plusDays(1)), any());
    }

    @Test
    void fetchAndPersist_capturesSeriesErrorsAsPartialResult() {
        when(macroRepo.findMaxObservationDate(anyString())).thenReturn(Optional.empty());
        when(fredClient.fetchObservations(anyString(), any(), any()))
                .thenThrow(new RuntimeException("FRED unavailable"));

        IngestionResult result = handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errors()).hasSize(7);
    }

    private List<FredObservationsResponse.Observation> observations() {
        return List.of(
                new FredObservationsResponse.Observation("2024-01-02", "3.95"),
                new FredObservationsResponse.Observation("2024-01-04", "3.88")
        );
    }
}

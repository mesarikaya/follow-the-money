package com.ftm.app.ingestion.service;

import com.ftm.app.api.repository.CategoryRepository;
import com.ftm.app.domain.Category;
import com.ftm.app.domain.CategoryType;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import com.ftm.app.ingestion.repository.BenchmarkPriceJdbcRepository;
import com.ftm.app.ingestion.repository.RawPriceJdbcRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PricesIngestionHandlerTest {

    @Mock CategoryRepository categoryRepository;
    @Mock YahooFinanceClient yahooClient;
    @Mock RawPriceJdbcRepository rawPriceRepo;
    @Mock BenchmarkPriceJdbcRepository benchmarkRepo;

    @InjectMocks PricesIngestionHandler handler;

    @Test
    void fetchAndPersist_insertsRowsForAllCategoriesAndBenchmarks() {
        Category tech = category("TECH", "XLK");
        when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(tech));
        when(rawPriceRepo.findMaxTradeDate("TECH")).thenReturn(Optional.empty());
        when(benchmarkRepo.findMaxTradeDate(any())).thenReturn(Optional.empty());
        when(yahooClient.fetchChart(eq("XLK"), any(), any())).thenReturn(Optional.of(chartResponse()));
        when(yahooClient.fetchChart(eq("SPY"), any(), any())).thenReturn(Optional.of(chartResponse()));
        when(yahooClient.fetchChart(eq("AGG"), any(), any())).thenReturn(Optional.of(chartResponse()));
        when(rawPriceRepo.batchInsert(any())).thenReturn(2);
        when(benchmarkRepo.batchInsert(any())).thenReturn(2);

        IngestionResult result = handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        assertThat(result.hasErrors()).isFalse();
        assertThat(result.rowsInserted()).isEqualTo(6); // 2 rows × 3 tickers
    }

    @Test
    void fetchAndPersist_usesMaxTradeDateForIncrementalFetch() {
        Category tech = category("TECH", "XLK");
        when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(tech));
        when(rawPriceRepo.findMaxTradeDate("TECH")).thenReturn(Optional.of(LocalDate.of(2024, 1, 3)));
        when(benchmarkRepo.findMaxTradeDate(any())).thenReturn(Optional.of(LocalDate.of(2024, 1, 3)));
        when(yahooClient.fetchChart(any(), any(), any())).thenReturn(Optional.of(chartResponse()));
        when(rawPriceRepo.batchInsert(any())).thenReturn(2);
        when(benchmarkRepo.batchInsert(any())).thenReturn(2);

        handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        ArgumentCaptor<LocalDate> fromCaptor = ArgumentCaptor.forClass(LocalDate.class);
        verify(yahooClient).fetchChart(eq("XLK"), fromCaptor.capture(), any());
        assertThat(fromCaptor.getValue()).isEqualTo(LocalDate.of(2024, 1, 4));
    }

    @Test
    void fetchAndPersist_capturesErrorsAndReturnsPartialResult() {
        Category tech = category("TECH", "XLK");
        when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(tech));
        when(rawPriceRepo.findMaxTradeDate("TECH")).thenReturn(Optional.empty());
        when(benchmarkRepo.findMaxTradeDate(any())).thenReturn(Optional.empty());
        when(yahooClient.fetchChart(eq("XLK"), any(), any()))
                .thenThrow(new RuntimeException("Connection refused"));
        when(yahooClient.fetchChart(eq("SPY"), any(), any())).thenReturn(Optional.of(chartResponse()));
        when(yahooClient.fetchChart(eq("AGG"), any(), any())).thenReturn(Optional.of(chartResponse()));
        when(benchmarkRepo.batchInsert(any())).thenReturn(2);

        IngestionResult result = handler.fetchAndPersist(LocalDate.of(2024, 1, 5));

        assertThat(result.hasErrors()).isTrue();
        assertThat(result.errors()).hasSize(1);
        assertThat(result.errors().get(0)).contains("TECH");
    }

    @Test
    void fetchAndPersist_skipsUpToDateCategories() {
        Category tech = category("TECH", "XLK");
        LocalDate today = LocalDate.of(2024, 1, 5);
        when(categoryRepository.findAllByActiveTrueOrderByDisplayOrderAsc()).thenReturn(List.of(tech));
        when(rawPriceRepo.findMaxTradeDate("TECH")).thenReturn(Optional.of(today));
        when(benchmarkRepo.findMaxTradeDate(any())).thenReturn(Optional.of(today));

        handler.fetchAndPersist(today);

        verify(yahooClient, never()).fetchChart(eq("XLK"), any(), any());
    }

    private Category category(String id, String ticker) {
        return new Category(id, "Technology", CategoryType.EQUITY_SECTOR, ticker, "SPY", 1, true);
    }

    private YahooChartResponse chartResponse() {
        long ts1 = 1704153600L;
        long ts2 = 1704240000L;
        BigDecimal p1 = new BigDecimal("145.12");
        BigDecimal p2 = new BigDecimal("146.00");
        YahooChartResponse.Quote quote = new YahooChartResponse.Quote(
                List.of(p1, p2), List.of(p1, p2), List.of(p1, p2), List.of(p1, p2), List.of(15000000L, 12000000L));
        YahooChartResponse.AdjClose adjClose = new YahooChartResponse.AdjClose(List.of(p1, p2));
        YahooChartResponse.Indicators indicators = new YahooChartResponse.Indicators(
                List.of(quote), List.of(adjClose));
        YahooChartResponse.Result result = new YahooChartResponse.Result(List.of(ts1, ts2), indicators);
        YahooChartResponse.Chart chart = new YahooChartResponse.Chart(List.of(result), null);
        return new YahooChartResponse(chart);
    }
}

package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.domain.Holding;
import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.ingestion.client.YahooFinanceClient;
import com.ftm.app.ingestion.client.dto.YahooChartResponse;
import com.ftm.app.portfolio.repository.HoldingRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.instancio.Instancio;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HoldingPriceServiceTest {

  @Mock HoldingRepository holdingRepository;
  @Mock YahooFinanceClient yahooFinanceClient;
  @Mock FredClient fredClient;
  @InjectMocks HoldingPriceService holdingPriceService;

  private static final BigDecimal FALLBACK_GBP_USD = new BigDecimal("1.27");
  private static final BigDecimal FALLBACK_USD_PER_EUR = new BigDecimal("1.08");

  private YahooChartResponse chartWithAdjClose(BigDecimal... values) {
    List<BigDecimal> adjCloseList = Arrays.asList(values);
    var adjClose = new YahooChartResponse.AdjClose(adjCloseList);
    var indicators = new YahooChartResponse.Indicators(List.of(), List.of(adjClose));
    var result = new YahooChartResponse.Result(List.of(), indicators);
    return new YahooChartResponse(new YahooChartResponse.Chart(List.of(result), null));
  }

  private Holding holding(String ticker, String categoryId, String priceSource) {
    return Instancio.of(Holding.class)
        .set(field(Holding::ticker), ticker)
        .set(field(Holding::categoryId), categoryId)
        .set(field(Holding::currency), "USD")
        .set(field(Holding::priceSource), priceSource)
        .create();
  }

  // ===== fetchGbpUsdRate =====

  @Test
  @DisplayName("fetchGbpUsdRate returns Yahoo adj_close when available")
  void shouldReturnGbpUsdRateFromYahoo() {
    var chart = chartWithAdjClose(new BigDecimal("1.265"), new BigDecimal("1.272"));
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.of(chart));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo("1.272");
  }

  @Test
  @DisplayName("fetchGbpUsdRate returns fallback 1.27 when Yahoo returns empty")
  void shouldReturnFallbackGbpUsdRateWhenYahooFails() {
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.empty());

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo(FALLBACK_GBP_USD);
  }

  @Test
  @DisplayName("fetchGbpUsdRate returns fallback when Yahoo throws exception")
  void shouldReturnFallbackGbpUsdRateOnException() {
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenThrow(new RuntimeException("network error"));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo(FALLBACK_GBP_USD);
  }

  // ===== adj_close extraction logic =====

  @Test
  @DisplayName("fetchGbpUsdRate skips trailing null adj_close entries and returns last non-null")
  void shouldSkipTrailingNullsInAdjClose() {
    var chart = chartWithAdjClose(new BigDecimal("1.260"), new BigDecimal("1.272"), null, null);
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.of(chart));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo("1.272");
  }

  @Test
  @DisplayName("fetchGbpUsdRate returns fallback when all adj_close entries are null")
  void shouldReturnFallbackWhenAllAdjCloseNull() {
    var chart = chartWithAdjClose((BigDecimal) null, null, null);
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.of(chart));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo(FALLBACK_GBP_USD);
  }

  // ===== refreshPricesForAllHoldings skip logic =====

  @Test
  @DisplayName("refreshPricesForAllHoldings skips placeholder tickers where ticker == categoryId")
  void shouldSkipPlaceholderTickers() {
    Holding cashHolding = holding("CASH", "CASH", "yahoo_finance");
    when(holdingRepository.findAll()).thenReturn(List.of(cashHolding));

    holdingPriceService.refreshPricesForAllHoldings();

    verify(yahooFinanceClient, never()).fetchChart(any(), any(), any());
  }

  @Test
  @DisplayName("refreshPricesForAllHoldings skips manually-priced holdings")
  void shouldSkipManuallyPricedHoldings() {
    Holding manualHolding = holding("RHM", "INDU", "manual");
    when(holdingRepository.findAll()).thenReturn(List.of(manualHolding));

    holdingPriceService.refreshPricesForAllHoldings();

    verify(yahooFinanceClient, never()).fetchChart(any(), any(), any());
  }

  @Test
  @DisplayName("refreshPricesForAllHoldings updates price from Yahoo for normal holdings")
  void shouldUpdatePriceFromYahooForNormalHolding() {
    Holding normalHolding = holding("XLK", "TECH", "yahoo_finance");
    var chart = chartWithAdjClose(new BigDecimal("195.50"));
    when(holdingRepository.findAll()).thenReturn(List.of(normalHolding));
    when(yahooFinanceClient.fetchChart(eq("XLK"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.of(chart));

    holdingPriceService.refreshPricesForAllHoldings();

    verify(holdingRepository)
        .updatePrice(
            eq("XLK"), eq(new BigDecimal("195.50")), any(LocalDate.class), eq("yahoo_finance"));
  }

  @Test
  @DisplayName("refreshPricesForAllHoldings skips update when Yahoo returns empty for ticker")
  void shouldNotUpdatePriceWhenYahooReturnsEmpty() {
    Holding normalHolding = holding("XLK", "TECH", "yahoo_finance");
    when(holdingRepository.findAll()).thenReturn(List.of(normalHolding));
    when(yahooFinanceClient.fetchChart(eq("XLK"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.empty());

    holdingPriceService.refreshPricesForAllHoldings();

    verify(holdingRepository, never()).updatePrice(any(), any(), any(), any());
  }
}

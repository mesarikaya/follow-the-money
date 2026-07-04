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
import com.ftm.app.portfolio.repository.PortfolioSnapshotRepository;
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
  @Mock PortfolioSnapshotRepository snapshotRepository;
  @InjectMocks HoldingPriceService holdingPriceService;

  private static final BigDecimal SYSTEM_DEFAULT_GBP_USD = new BigDecimal("1.27");
  private static final BigDecimal SYSTEM_DEFAULT_USD_PER_EUR = new BigDecimal("1.08");

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
  @DisplayName("fetchGbpUsdRate falls back to last DB rate when Yahoo returns empty")
  void shouldReturnDbRateWhenYahooFails() {
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.empty());
    when(snapshotRepository.findLastFxRate("GBP_USD"))
        .thenReturn(Optional.of(new BigDecimal("1.2850")));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo("1.2850");
  }

  @Test
  @DisplayName("fetchGbpUsdRate falls back to last DB rate when Yahoo throws exception")
  void shouldReturnDbRateOnYahooException() {
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenThrow(new RuntimeException("network error"));
    when(snapshotRepository.findLastFxRate("GBP_USD"))
        .thenReturn(Optional.of(new BigDecimal("1.2780")));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo("1.2780");
  }

  @Test
  @DisplayName("fetchGbpUsdRate uses system default when Yahoo fails and DB has no history")
  void shouldReturnSystemDefaultWhenYahooAndDbBothFail() {
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.empty());
    when(snapshotRepository.findLastFxRate("GBP_USD")).thenReturn(Optional.empty());

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo(SYSTEM_DEFAULT_GBP_USD);
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
  @DisplayName("fetchGbpUsdRate falls back to DB rate when all adj_close entries are null")
  void shouldReturnDbRateWhenAllAdjCloseNull() {
    var chart = chartWithAdjClose((BigDecimal) null, null, null);
    when(yahooFinanceClient.fetchChart(eq("GBPUSD=X"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.of(chart));
    when(snapshotRepository.findLastFxRate("GBP_USD"))
        .thenReturn(Optional.of(new BigDecimal("1.2720")));

    BigDecimal rate = holdingPriceService.fetchGbpUsdRate();

    assertThat(rate).isEqualByComparingTo("1.2720");
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
  @DisplayName("refreshPricesForAllHoldings refreshes a manually-priced holding when live data exists")
  void shouldRefreshManualHoldingWhenLiveDataAvailable() {
    Holding manualHolding = holding("RHM.DE", "INDU", "manual");
    var chart = chartWithAdjClose(new BigDecimal("1093.00"));
    when(holdingRepository.findAll()).thenReturn(List.of(manualHolding));
    when(yahooFinanceClient.fetchChart(eq("RHM.DE"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.of(chart));

    holdingPriceService.refreshPricesForAllHoldings();

    verify(holdingRepository)
        .updatePrice(
            eq("RHM.DE"), eq(new BigDecimal("1093.00")), any(LocalDate.class), eq("yahoo_finance"));
  }

  @Test
  @DisplayName("refreshPricesForAllHoldings keeps a manual price when the provider has no data")
  void shouldPreserveManualPriceWhenYahooHasNoData() {
    Holding manualHolding = holding("FISV", "FINL_FINT", "manual");
    when(holdingRepository.findAll()).thenReturn(List.of(manualHolding));
    when(yahooFinanceClient.fetchChart(eq("FISV"), any(LocalDate.class), any(LocalDate.class)))
        .thenReturn(Optional.empty());

    holdingPriceService.refreshPricesForAllHoldings();

    verify(holdingRepository, never()).updatePrice(any(), any(), any(), any());
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

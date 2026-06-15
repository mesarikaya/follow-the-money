package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.portfolio.domain.PortfolioValueSnapshot;
import com.ftm.app.portfolio.repository.PortfolioSnapshotRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PortfolioSnapshotServiceTest {

  @Mock PortfolioSnapshotRepository snapshotRepository;
  @Mock HoldingPriceService holdingPriceService;
  @InjectMocks PortfolioSnapshotService portfolioSnapshotService;

  @Test
  @DisplayName("captureSnapshot: skips when holdings list is empty — no DB writes, no FX fetches")
  void shouldSkipWhenHoldingsEmpty() {
    portfolioSnapshotService.captureSnapshot(List.of());

    verify(snapshotRepository, never()).upsertSnapshot(any());
    verify(holdingPriceService, never()).fetchUsdPerEurRate();
    verify(holdingPriceService, never()).fetchGbpUsdRate();
    verify(holdingPriceService, never()).fetchSekUsdRate();
  }

  @Test
  @DisplayName("captureSnapshot: skips when all holdings have null EUR value — total is zero")
  void shouldSkipWhenTotalValueIsZero() {
    portfolioSnapshotService.captureSnapshot(List.of(holdingWithEurValue(null), holdingWithEurValue(null)));

    verify(snapshotRepository, never()).upsertSnapshot(any());
    verify(holdingPriceService, never()).fetchUsdPerEurRate();
  }

  @Test
  @DisplayName("captureSnapshot: stores snapshot with correct total EUR value and holding count")
  void shouldStoreTotalValueInSnapshot() {
    HoldingDto h1 = holdingWithEurValue(new BigDecimal("1000.00"));
    HoldingDto h2 = holdingWithEurValue(new BigDecimal("2500.50"));
    stubFxRates();

    portfolioSnapshotService.captureSnapshot(List.of(h1, h2));

    ArgumentCaptor<PortfolioValueSnapshot> captor = ArgumentCaptor.forClass(PortfolioValueSnapshot.class);
    verify(snapshotRepository).upsertSnapshot(captor.capture());
    PortfolioValueSnapshot saved = captor.getValue();
    assertThat(saved.totalValueEur()).isEqualByComparingTo("3500.50");
    assertThat(saved.holdingCount()).isEqualTo(2);
    assertThat(saved.snapshotDate()).isEqualTo(LocalDate.now());
  }

  @Test
  @DisplayName("captureSnapshot: computes cost basis using (avgCost / currentPrice) × marketValueEur")
  void shouldComputeCostBasisFromCostToCurrentPriceRatio() {
    // avgCostLocal=80, currentPriceLocal=100, marketValueEur=1000 → costEur = 1000 × 0.8 = 800
    HoldingDto holding = new HoldingDto(
        "XLK", "Tech ETF", "TECH", "USD",
        new BigDecimal("10"),
        new BigDecimal("80.00"),
        null, null,
        new BigDecimal("100.00"),
        LocalDate.now(), "yahoo_finance",
        new BigDecimal("1000.00"));
    stubFxRates();

    portfolioSnapshotService.captureSnapshot(List.of(holding));

    ArgumentCaptor<PortfolioValueSnapshot> captor = ArgumentCaptor.forClass(PortfolioValueSnapshot.class);
    verify(snapshotRepository).upsertSnapshot(captor.capture());
    assertThat(captor.getValue().totalCostEur()).isEqualByComparingTo("800.00");
  }

  @Test
  @DisplayName("captureSnapshot: stores three FX rates with correct currency pairs and sources")
  void shouldCaptureFxRatesAfterSnapshot() {
    stubFxRates();

    portfolioSnapshotService.captureSnapshot(List.of(holdingWithEurValue(new BigDecimal("5000.00"))));

    verify(snapshotRepository).upsertFxRate(any(LocalDate.class), eq("USD_PER_EUR"), eq(new BigDecimal("1.08")), eq("FRED"));
    verify(snapshotRepository).upsertFxRate(any(LocalDate.class), eq("GBP_USD"), eq(new BigDecimal("1.27")), eq("YAHOO"));
    verify(snapshotRepository).upsertFxRate(any(LocalDate.class), eq("SEK_USD"), eq(new BigDecimal("0.092")), eq("YAHOO"));
  }

  @Test
  @DisplayName("captureSnapshot: snapshot is still saved when one FX fetch throws — remaining rates still stored")
  void shouldTolerateIndividualFxRateFetchErrors() {
    when(holdingPriceService.fetchUsdPerEurRate()).thenThrow(new RuntimeException("FRED down"));
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(new BigDecimal("1.27"));
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(new BigDecimal("0.092"));

    portfolioSnapshotService.captureSnapshot(List.of(holdingWithEurValue(new BigDecimal("3000.00"))));

    verify(snapshotRepository).upsertSnapshot(any());
    // USD_PER_EUR failed; GBP_USD and SEK_USD still written
    verify(snapshotRepository, times(2)).upsertFxRate(any(), any(), any(), any());
  }

  @Test
  @DisplayName("getRecentSnapshots: delegates to repository with the requested day count")
  void shouldDelegateToRepositoryForSnapshots() {
    List<PortfolioValueSnapshot> expected =
        List.of(new PortfolioValueSnapshot(LocalDate.now(), new BigDecimal("10000"), new BigDecimal("9000"), 5));
    when(snapshotRepository.findRecentSnapshots(30)).thenReturn(expected);

    List<PortfolioValueSnapshot> result = portfolioSnapshotService.getRecentSnapshots(30);

    assertThat(result).isSameAs(expected);
  }

  private void stubFxRates() {
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(new BigDecimal("1.08"));
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(new BigDecimal("1.27"));
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(new BigDecimal("0.092"));
  }

  private HoldingDto holdingWithEurValue(BigDecimal marketValueEur) {
    return new HoldingDto(
        "XLK", "Tech ETF", "TECH", "USD",
        new BigDecimal("10"),
        new BigDecimal("195.00"),
        null, null,
        new BigDecimal("200.00"),
        LocalDate.now(), "yahoo_finance",
        marketValueEur);
  }
}

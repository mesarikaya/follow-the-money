package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.domain.Holding;
import com.ftm.app.portfolio.repository.HoldingRepository;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class HoldingUploadServiceTest {

  @Mock HoldingRepository holdingRepository;
  @Mock HoldingClassificationService classificationService;
  @Spy HoldingCsvParser csvParser = new HoldingCsvParser();
  @Mock HoldingPriceService holdingPriceService;
  @InjectMocks HoldingUploadService holdingUploadService;

  private static final BigDecimal USD_PER_EUR = new BigDecimal("1.085");

  private static final String USD_CSV =
      """
      ticker,name,quantity,currency,avg_cost
      XLK,Tech ETF,10.0,USD,195.50
      GLD,Gold ETF,5.0,USD,210.00
      """;

  private static final String EUR_CSV =
      """
      ticker,name,quantity,currency,avg_cost
      RHM,Rheinmetall,3.0,EUR,1200.00
      """;

  private Holding storedHolding(String ticker, String categoryId) {
    return new Holding(
        1L,
        ticker,
        ticker + " name",
        categoryId,
        "USD",
        new BigDecimal("10.0"),
        new BigDecimal("100.00"),
        null,
        OffsetDateTime.now(),
        null,
        null,
        null);
  }

  @Test
  @DisplayName("upload processes USD CSV and stores holdings")
  void shouldUploadUsdHoldingsWithoutFxFetch() throws Exception {
    when(classificationService.classifyOrUnknown("XLK")).thenReturn("TECH");
    when(classificationService.classifyOrUnknown("GLD")).thenReturn("GOLD");
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingRepository.findAll()).thenReturn(List.of(
        storedHolding("XLK", "TECH"), storedHolding("GLD", "GOLD")));

    HoldingsUploadResponse response = holdingUploadService.upload(USD_CSV);

    assertThat(response.totalAccepted()).isEqualTo(2);
    assertThat(response.unclassifiedTickers()).isEmpty();
    verify(holdingRepository).replaceAll(any());
    verify(holdingPriceService).refreshPricesForAllHoldings();
  }

  @Test
  @DisplayName("upload records unclassified tickers in response")
  void shouldRecordUnclassifiedTickers() throws Exception {
    when(classificationService.classifyOrUnknown("XLK")).thenReturn("TECH");
    when(classificationService.classifyOrUnknown("GLD")).thenReturn(null);
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingRepository.findAll()).thenReturn(List.of(
        storedHolding("XLK", "TECH"), storedHolding("GLD", null)));

    HoldingsUploadResponse response = holdingUploadService.upload(USD_CSV);

    assertThat(response.unclassifiedTickers()).containsExactly("GLD");
  }

  @Test
  @DisplayName("upload triggers price refresh for all holdings")
  void shouldTriggerPriceRefreshAfterUpload() throws Exception {
    when(classificationService.classifyOrUnknown("RHM")).thenReturn("INDU");
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingRepository.findAll()).thenReturn(List.of(storedHolding("RHM", "INDU")));

    holdingUploadService.upload(EUR_CSV);

    verify(holdingPriceService).refreshPricesForAllHoldings();
  }

  @Test
  @DisplayName("getHoldings maps all stored holdings to dtos")
  void shouldReturnAllHoldings() {
    when(holdingRepository.findAll())
        .thenReturn(List.of(storedHolding("XLK", "TECH"), storedHolding("GLD", "GOLD")));
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);

    List<HoldingDto> holdings = holdingUploadService.getHoldings();

    assertThat(holdings).hasSize(2);
    assertThat(holdings).extracting(HoldingDto::ticker).containsExactlyInAnyOrder("XLK", "GLD");
  }

  @Test
  @DisplayName("updateHolding updates quantity and returns updated dto")
  void shouldUpdateHolding() {
    Holding existing = storedHolding("XLK", "TECH");
    when(holdingRepository.updateByTicker("XLK", new BigDecimal("15.0"), new BigDecimal("200.00")))
        .thenReturn(1);
    when(holdingRepository.findAll()).thenReturn(List.of(existing));
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);

    HoldingDto result =
        holdingUploadService.updateHolding(
            "XLK", new HoldingUpdateRequest(new BigDecimal("15.0"), new BigDecimal("200.00")));

    assertThat(result.ticker()).isEqualTo("XLK");
    verify(holdingRepository)
        .updateByTicker("XLK", new BigDecimal("15.0"), new BigDecimal("200.00"));
  }

  @Test
  @DisplayName("generateCsvTemplate returns CSV string with header row")
  void shouldReturnCsvTemplate() {
    String template = holdingUploadService.generateCsvTemplate();

    assertThat(template).startsWith("ticker,name,quantity,currency,avg_cost");
    assertThat(template).contains("XLK");
  }
}

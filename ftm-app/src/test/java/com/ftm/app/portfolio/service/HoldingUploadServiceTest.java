package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.domain.Holding;
import com.ftm.app.portfolio.repository.HoldingRepository;
import com.ftm.app.portfolio.repository.PortfolioRepository;
import java.math.BigDecimal;
import java.util.List;
import org.instancio.Instancio;
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
  @Mock PortfolioRepository portfolioRepository;
  @Mock HoldingClassificationService classificationService;
  @Spy HoldingCsvParser csvParser = new HoldingCsvParser();
  @Mock HoldingPriceService holdingPriceService;
  @Mock PortfolioSnapshotService portfolioSnapshotService;
  @InjectMocks HoldingUploadService holdingUploadService;

  private static final BigDecimal USD_PER_EUR = new BigDecimal("1.085");
  private static final BigDecimal GBP_USD_RATE = new BigDecimal("1.27");
  private static final BigDecimal SEK_USD_RATE = new BigDecimal("0.092");

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
    return Instancio.of(Holding.class)
        .set(field(Holding::id), 1L)
        .set(field(Holding::ticker), ticker)
        .set(field(Holding::categoryId), categoryId)
        .set(field(Holding::currency), "USD")
        .create();
  }

  @Test
  @DisplayName("upload processes USD CSV and stores holdings")
  void shouldUploadUsdHoldingsWithoutFxFetch() throws Exception {
    when(classificationService.classifyOrUnknown("XLK")).thenReturn("TECH");
    when(classificationService.classifyOrUnknown("GLD")).thenReturn("GOLD");
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);
    when(holdingRepository.findAll())
        .thenReturn(List.of(storedHolding("XLK", "TECH"), storedHolding("GLD", "GOLD")));

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
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);
    when(holdingRepository.findAll())
        .thenReturn(List.of(storedHolding("XLK", "TECH"), storedHolding("GLD", null)));

    HoldingsUploadResponse response = holdingUploadService.upload(USD_CSV);

    assertThat(response.unclassifiedTickers()).containsExactly("GLD");
  }

  @Test
  @DisplayName("upload triggers price refresh for all holdings")
  void shouldTriggerPriceRefreshAfterUpload() throws Exception {
    when(classificationService.classifyOrUnknown("RHM")).thenReturn("INDU");
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);
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
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);

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
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);

    HoldingDto result =
        holdingUploadService.updateHolding(
            "XLK",
            new HoldingUpdateRequest(new BigDecimal("15.0"), new BigDecimal("200.00"), null));

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

  @Test
  @DisplayName("GBX currency (pence) is normalized to GBP for EUR market value computation")
  void shouldConvertGbxPenceToPoundsForEurValue() throws Exception {
    // BA.L at 1900 pence (GBX) with 200 shares; GBP/USD=1.27, USD/EUR=1.085
    // Expected EUR value: 200 * (1900/100) * 1.27 / 1.085 = 200 * 19 * 1.27 / 1.085 ≈ €4,442
    String gbxCsv =
        """
        ticker,name,quantity,currency,avg_cost
        BA.L,BAE Systems,200.0,GBX,1900.00
        """;

    Holding gbxHolding =
        Instancio.of(Holding.class)
            .set(field(Holding::ticker), "BA.L")
            .set(field(Holding::categoryId), "INDU_ADEF")
            .set(field(Holding::currency), "GBX")
            .set(field(Holding::quantity), new BigDecimal("200"))
            .set(field(Holding::avgCostLocal), new BigDecimal("1900.00"))
            .set(field(Holding::currentPriceLocal), null)
            .set(field(Holding::usdFxRate), null)
            .create();

    when(classificationService.classifyOrUnknown("BA.L")).thenReturn("INDU_ADEF");
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);
    when(holdingRepository.findAll()).thenReturn(List.of(gbxHolding));

    HoldingsUploadResponse response = holdingUploadService.upload(gbxCsv);

    assertThat(response.holdings()).hasSize(1);
    HoldingDto dto = response.holdings().getFirst();
    // EUR value must be non-null for GBX holdings
    assertThat(dto.marketValueEur()).isNotNull();
    // 200 * (1900/100) * 1.27 / 1.085 ≈ 4441
    assertThat(dto.marketValueEur()).isGreaterThan(new BigDecimal("4000"));
    assertThat(dto.marketValueEur()).isLessThan(new BigDecimal("5000"));
  }

  @Test
  @DisplayName("SEK currency is converted to EUR via SEK/USD and USD/EUR rates")
  void shouldConvertSekToEur() throws Exception {
    // SAAB at 360 SEK with 100 shares; SEK/USD=0.092, USD/EUR=1.085
    // Expected EUR value: 100 * 360 * 0.092 / 1.085 ≈ €3,055
    String sekCsv =
        """
        ticker,name,quantity,currency,avg_cost
        SAAB-B.ST,Saab AB,100.0,SEK,360.00
        """;

    Holding sekHolding =
        Instancio.of(Holding.class)
            .set(field(Holding::ticker), "SAAB-B.ST")
            .set(field(Holding::categoryId), "INDU_ADEF")
            .set(field(Holding::currency), "SEK")
            .set(field(Holding::quantity), new BigDecimal("100"))
            .set(field(Holding::avgCostLocal), new BigDecimal("360.00"))
            .set(field(Holding::currentPriceLocal), null)
            .set(field(Holding::usdFxRate), null)
            .create();

    when(classificationService.classifyOrUnknown("SAAB-B.ST")).thenReturn("INDU_ADEF");
    doNothing().when(holdingPriceService).refreshPricesForAllHoldings();
    when(holdingPriceService.fetchUsdPerEurRate()).thenReturn(USD_PER_EUR);
    when(holdingPriceService.fetchGbpUsdRate()).thenReturn(GBP_USD_RATE);
    when(holdingPriceService.fetchSekUsdRate()).thenReturn(SEK_USD_RATE);
    when(holdingRepository.findAll()).thenReturn(List.of(sekHolding));

    HoldingsUploadResponse response = holdingUploadService.upload(sekCsv);

    assertThat(response.holdings()).hasSize(1);
    HoldingDto dto = response.holdings().getFirst();
    assertThat(dto.marketValueEur()).isNotNull();
    // 100 * 360 * 0.092 / 1.085 ≈ 3,055
    assertThat(dto.marketValueEur()).isGreaterThan(new BigDecimal("2000"));
    assertThat(dto.marketValueEur()).isLessThan(new BigDecimal("4000"));
  }
}

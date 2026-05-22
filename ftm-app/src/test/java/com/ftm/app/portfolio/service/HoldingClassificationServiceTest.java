package com.ftm.app.portfolio.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.ftm.app.portfolio.repository.TickerMappingRepository;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HoldingClassificationServiceTest {

  private HoldingClassificationService service;

  @BeforeEach
  void setUp() {
    TickerMappingRepository repository = mock(TickerMappingRepository.class);
    when(repository.findAllAsMap())
        .thenReturn(
            Map.ofEntries(
                Map.entry("XLK", "TECH"),
                Map.entry("XLF", "FINL"),
                Map.entry("XLE", "ENRG"),
                Map.entry("XLV", "HLTH"),
                Map.entry("XLI", "INDU"),
                Map.entry("XLY", "DISR"),
                Map.entry("XLP", "STPL"),
                Map.entry("GLD", "GOLD"),
                Map.entry("IAU", "GOLD"),
                Map.entry("SLV", "SLVR"),
                Map.entry("GDX", "GDMN"),
                Map.entry("TLT", "TLTD"),
                Map.entry("IEF", "TINT"),
                Map.entry("AGG", "TINT"),
                Map.entry("HYG", "HIYLD"),
                Map.entry("BIL", "CASH"),
                Map.entry("LQD", "CORP"),
                Map.entry("RHM", "INDU"),
                Map.entry("BAESY", "INDU"),
                Map.entry("AIR", "INDU"),
                Map.entry("LMT", "INDU"),
                Map.entry("BNTX", "HLTH"),
                Map.entry("ASML", "TECH"),
                Map.entry("PYPL", "FINL"),
                Map.entry("BA", "INDU"),
                Map.entry("PFE", "HLTH"),
                Map.entry("QS", "MATL"),
                Map.entry("SPCE", "INDU"),
                Map.entry("WKL", "TECH"),
                Map.entry("DFEU", "INDU"),
                Map.entry("FISV", "FINL"),
                Map.entry("DIS", "COMM"),
                Map.entry("GD", "INDU")));
    service = new HoldingClassificationService(repository);
    service.loadCache();
  }

  @Test
  @DisplayName("classifies US sector ETFs to correct category IDs")
  void shouldClassifyUsSectorEtfs() {
    assertThat(service.classify("XLK")).hasValue("TECH");
    assertThat(service.classify("XLF")).hasValue("FINL");
    assertThat(service.classify("XLE")).hasValue("ENRG");
    assertThat(service.classify("XLV")).hasValue("HLTH");
    assertThat(service.classify("XLI")).hasValue("INDU");
    assertThat(service.classify("XLY")).hasValue("DISR");
    assertThat(service.classify("XLP")).hasValue("STPL");
  }

  @Test
  @DisplayName("classifies ticker case-insensitively")
  void shouldClassifyCaseInsensitively() {
    assertThat(service.classify("xlk")).hasValue("TECH");
    assertThat(service.classify("Xlk")).hasValue("TECH");
    assertThat(service.classify("XLK")).hasValue("TECH");
  }

  @Test
  @DisplayName("classifies European defense stocks to INDU")
  void shouldClassifyEuropeanDefenseToIndu() {
    assertThat(service.classify("RHM")).hasValue("INDU");
    assertThat(service.classify("BAESY")).hasValue("INDU");
    assertThat(service.classify("AIR")).hasValue("INDU");
    assertThat(service.classify("LMT")).hasValue("INDU");
  }

  @Test
  @DisplayName("classifies precious metals ETFs to correct category IDs")
  void shouldClassifyPreciousMetals() {
    assertThat(service.classify("GLD")).hasValue("GOLD");
    assertThat(service.classify("IAU")).hasValue("GOLD");
    assertThat(service.classify("SLV")).hasValue("SLVR");
    assertThat(service.classify("GDX")).hasValue("GDMN");
  }

  @Test
  @DisplayName("classifies fixed income ETFs to correct category IDs")
  void shouldClassifyFixedIncomeEtfs() {
    assertThat(service.classify("TLT")).hasValue("TLTD");
    assertThat(service.classify("IEF")).hasValue("TINT");
    assertThat(service.classify("AGG")).hasValue("TINT");
    assertThat(service.classify("HYG")).hasValue("HIYLD");
    assertThat(service.classify("BIL")).hasValue("CASH");
    assertThat(service.classify("LQD")).hasValue("CORP");
  }

  @Test
  @DisplayName("classifies user portfolio tickers correctly")
  void shouldClassifyUserPortfolioTickers() {
    assertThat(service.classify("BNTX")).hasValue("HLTH");
    assertThat(service.classify("AIR")).hasValue("INDU");
    assertThat(service.classify("ASML")).hasValue("TECH");
    assertThat(service.classify("PYPL")).hasValue("FINL");
    assertThat(service.classify("BA")).hasValue("INDU");
    assertThat(service.classify("PFE")).hasValue("HLTH");
    assertThat(service.classify("QS")).hasValue("MATL");
    assertThat(service.classify("RHM")).hasValue("INDU");
    assertThat(service.classify("SPCE")).hasValue("INDU");
    assertThat(service.classify("WKL")).hasValue("TECH");
    assertThat(service.classify("DFEU")).hasValue("INDU");
    assertThat(service.classify("FISV")).hasValue("FINL");
    assertThat(service.classify("DIS")).hasValue("COMM");
    assertThat(service.classify("GD")).hasValue("INDU");
    assertThat(service.classify("LMT")).hasValue("INDU");
  }

  @Test
  @DisplayName("returns empty for unknown tickers")
  void shouldReturnEmptyForUnknownTickers() {
    assertThat(service.classify("UNKNOWN_XYZ")).isEmpty();
    assertThat(service.classify("ZZZZZ")).isEmpty();
    assertThat(service.classifyOrUnknown("UNKNOWN_XYZ")).isNull();
  }
}

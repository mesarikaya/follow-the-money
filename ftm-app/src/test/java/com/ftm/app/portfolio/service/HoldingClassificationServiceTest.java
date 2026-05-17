package com.ftm.app.portfolio.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HoldingClassificationServiceTest {

    private final HoldingClassificationService service = new HoldingClassificationService();

    @Test
    @DisplayName("classifies US sector ETFs to correct category")
    void shouldClassifyUsSectorEtfs() {
        assertThat(service.classify("XLK")).hasValue("TECH");
        assertThat(service.classify("XLF")).hasValue("FINANCIAL");
        assertThat(service.classify("XLE")).hasValue("ENERGY");
        assertThat(service.classify("XLV")).hasValue("HEALTHCARE");
        assertThat(service.classify("XLI")).hasValue("INDUSTRIAL");
        assertThat(service.classify("XLY")).hasValue("CONSUMER_DISC");
        assertThat(service.classify("XLP")).hasValue("CONSUMER_STAPLES");
    }

    @Test
    @DisplayName("classifies ticker case-insensitively")
    void shouldClassifyCaseInsensitively() {
        assertThat(service.classify("xlk")).hasValue("TECH");
        assertThat(service.classify("Xlk")).hasValue("TECH");
        assertThat(service.classify("XLK")).hasValue("TECH");
    }

    @Test
    @DisplayName("classifies European defense stocks to INDUSTRIAL")
    void shouldClassifyEuropeanDefenseToIndustrial() {
        assertThat(service.classify("RHM")).hasValue("INDUSTRIAL");    // Rheinmetall
        assertThat(service.classify("BAESY")).hasValue("INDUSTRIAL");  // BAE Systems ADR
        assertThat(service.classify("AIR")).hasValue("INDUSTRIAL");    // Airbus
        assertThat(service.classify("LMT")).hasValue("INDUSTRIAL");    // Lockheed Martin
    }

    @Test
    @DisplayName("classifies precious metals ETFs to GOLD or SILVER")
    void shouldClassifyPreciousMetals() {
        assertThat(service.classify("GLD")).hasValue("GOLD");
        assertThat(service.classify("IAU")).hasValue("GOLD");
        assertThat(service.classify("SLV")).hasValue("SILVER");
    }

    @Test
    @DisplayName("classifies fixed income ETFs correctly")
    void shouldClassifyFixedIncomeEtfs() {
        assertThat(service.classify("TLT")).hasValue("BOND_LONG");
        assertThat(service.classify("IEF")).hasValue("BOND_MED");
        assertThat(service.classify("AGG")).hasValue("BOND_AGG");
        assertThat(service.classify("HYG")).hasValue("BOND_HY");
    }

    @Test
    @DisplayName("returns empty for unknown tickers")
    void shouldReturnEmptyForUnknownTickers() {
        assertThat(service.classify("UNKNOWN_XYZ")).isEmpty();
        assertThat(service.classify("ZZZZZ")).isEmpty();
        assertThat(service.classifyOrUnknown("UNKNOWN_XYZ")).isNull();
    }
}

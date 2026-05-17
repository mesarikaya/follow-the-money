package com.ftm.app.portfolio.service;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

/**
 * Maps investment tickers to FTM category IDs.
 * Covers major US sector ETFs, large-cap stocks, and key European names.
 * Unknown tickers are classified as null (UNCLASSIFIED).
 */
@Service
public class HoldingClassificationService {

    private static final Map<String, String> TICKER_TO_CATEGORY = Map.ofEntries(
            // Equity sector ETFs (US)
            Map.entry("XLK",  "TECH"),
            Map.entry("QQQ",  "TECH"),
            Map.entry("VGT",  "TECH"),
            Map.entry("SOXX", "TECH"),
            Map.entry("SMH",  "TECH"),
            Map.entry("XLF",  "FINANCIAL"),
            Map.entry("VFH",  "FINANCIAL"),
            Map.entry("KRE",  "FINANCIAL"),
            Map.entry("XLE",  "ENERGY"),
            Map.entry("VDE",  "ENERGY"),
            Map.entry("OIH",  "ENERGY"),
            Map.entry("XLV",  "HEALTHCARE"),
            Map.entry("IBB",  "HEALTHCARE"),
            Map.entry("VHT",  "HEALTHCARE"),
            Map.entry("XLY",  "CONSUMER_DISC"),
            Map.entry("VCR",  "CONSUMER_DISC"),
            Map.entry("XLP",  "CONSUMER_STAPLES"),
            Map.entry("VDC",  "CONSUMER_STAPLES"),
            Map.entry("XLI",  "INDUSTRIAL"),
            Map.entry("VIS",  "INDUSTRIAL"),
            Map.entry("XLU",  "UTILITIES"),
            Map.entry("VPU",  "UTILITIES"),
            Map.entry("XLRE", "REAL_ESTATE"),
            Map.entry("VNQ",  "REAL_ESTATE"),
            Map.entry("XLB",  "MATERIALS"),
            Map.entry("VAW",  "MATERIALS"),
            Map.entry("XLC",  "COMM_SERVICES"),
            Map.entry("VOX",  "COMM_SERVICES"),

            // Fixed income ETFs
            Map.entry("TLT",  "BOND_LONG"),
            Map.entry("EDV",  "BOND_LONG"),
            Map.entry("ZROZ", "BOND_LONG"),
            Map.entry("IEF",  "BOND_MED"),
            Map.entry("VGIT", "BOND_MED"),
            Map.entry("SHY",  "BOND_SHORT"),
            Map.entry("BIL",  "BOND_SHORT"),
            Map.entry("AGG",  "BOND_AGG"),
            Map.entry("BND",  "BOND_AGG"),
            Map.entry("LQD",  "BOND_CORP"),
            Map.entry("HYG",  "BOND_HY"),
            Map.entry("JNK",  "BOND_HY"),
            Map.entry("EMB",  "BOND_EM"),
            Map.entry("VWOB", "BOND_EM"),

            // Precious metals
            Map.entry("GLD",  "GOLD"),
            Map.entry("IAU",  "GOLD"),
            Map.entry("SLV",  "SILVER"),
            Map.entry("SIVR", "SILVER"),
            Map.entry("PALL", "GOLD"),

            // Currency ETFs
            Map.entry("FXE",  "EUR_USD"),
            Map.entry("FXB",  "EUR_USD"),
            Map.entry("UUP",  "USD_INDEX"),
            Map.entry("UDN",  "USD_INDEX"),

            // US large-cap tech
            Map.entry("AAPL",  "TECH"),
            Map.entry("MSFT",  "TECH"),
            Map.entry("NVDA",  "TECH"),
            Map.entry("AVGO",  "TECH"),
            Map.entry("META",  "TECH"),
            Map.entry("GOOGL", "TECH"),
            Map.entry("GOOG",  "TECH"),
            Map.entry("AMZN",  "TECH"),
            Map.entry("TSLA",  "CONSUMER_DISC"),
            Map.entry("AMD",   "TECH"),
            Map.entry("INTC",  "TECH"),
            Map.entry("QCOM",  "TECH"),
            Map.entry("CRM",   "TECH"),
            Map.entry("ORCL",  "TECH"),
            Map.entry("SAP",   "TECH"),

            // US large-cap financials
            Map.entry("JPM",  "FINANCIAL"),
            Map.entry("BAC",  "FINANCIAL"),
            Map.entry("WFC",  "FINANCIAL"),
            Map.entry("GS",   "FINANCIAL"),
            Map.entry("MS",   "FINANCIAL"),
            Map.entry("BLK",  "FINANCIAL"),
            Map.entry("V",    "FINANCIAL"),
            Map.entry("MA",   "FINANCIAL"),

            // US large-cap healthcare
            Map.entry("LLY",  "HEALTHCARE"),
            Map.entry("UNH",  "HEALTHCARE"),
            Map.entry("JNJ",  "HEALTHCARE"),
            Map.entry("ABT",  "HEALTHCARE"),
            Map.entry("MRK",  "HEALTHCARE"),
            Map.entry("PFE",  "HEALTHCARE"),
            Map.entry("BMY",  "HEALTHCARE"),

            // US large-cap energy
            Map.entry("XOM",  "ENERGY"),
            Map.entry("CVX",  "ENERGY"),
            Map.entry("COP",  "ENERGY"),
            Map.entry("SLB",  "ENERGY"),

            // US large-cap industrials / defense
            Map.entry("CAT",  "INDUSTRIAL"),
            Map.entry("DE",   "INDUSTRIAL"),
            Map.entry("HON",  "INDUSTRIAL"),
            Map.entry("GE",   "INDUSTRIAL"),
            Map.entry("RTX",  "INDUSTRIAL"),
            Map.entry("LMT",  "INDUSTRIAL"),
            Map.entry("NOC",  "INDUSTRIAL"),
            Map.entry("GD",   "INDUSTRIAL"),
            Map.entry("BA",   "INDUSTRIAL"),
            Map.entry("LHX",  "INDUSTRIAL"),

            // European defense stocks (GICS: Industrials)
            Map.entry("RHM",   "INDUSTRIAL"),  // Rheinmetall (Frankfurt)
            Map.entry("BAESY", "INDUSTRIAL"),  // BAE Systems ADR
            Map.entry("BAES",  "INDUSTRIAL"),  // BAE Systems (London)
            Map.entry("SAF",   "INDUSTRIAL"),  // Safran (Paris)
            Map.entry("AIR",   "INDUSTRIAL"),  // Airbus (Paris/Frankfurt)
            Map.entry("EADSY", "INDUSTRIAL"),  // Airbus ADR
            Map.entry("LDOS",  "INDUSTRIAL"),  // Leidos
            Map.entry("AVAV",  "INDUSTRIAL"),  // AeroVironment
            Map.entry("HEI",   "INDUSTRIAL"),  // HEICO
            Map.entry("TDG",   "INDUSTRIAL"),  // TransDigm
            Map.entry("DASSF", "INDUSTRIAL"),  // Dassault Aviation
            Map.entry("LEO",   "INDUSTRIAL"),  // Leonardo (Milan)
            Map.entry("BAVA",  "INDUSTRIAL"),  // Bavarian Nordic

            // European financials
            Map.entry("ING",   "FINANCIAL"),
            Map.entry("BNP",   "FINANCIAL"),  // BNP Paribas
            Map.entry("BNPQY","FINANCIAL"),
            Map.entry("SAN",   "FINANCIAL"),  // Santander
            Map.entry("AXA",   "FINANCIAL"),
            Map.entry("AXAHY","FINANCIAL"),
            Map.entry("DB",    "FINANCIAL"),  // Deutsche Bank
            Map.entry("UBS",   "FINANCIAL"),
            Map.entry("CS",    "FINANCIAL"),

            // Consumer staples
            Map.entry("PG",   "CONSUMER_STAPLES"),
            Map.entry("KO",   "CONSUMER_STAPLES"),
            Map.entry("PEP",  "CONSUMER_STAPLES"),
            Map.entry("COST", "CONSUMER_STAPLES"),
            Map.entry("WMT",  "CONSUMER_STAPLES"),
            Map.entry("NESN", "CONSUMER_STAPLES"),  // Nestlé
            Map.entry("UL",   "CONSUMER_STAPLES"),  // Unilever
            Map.entry("LVMH", "CONSUMER_DISC"),
            Map.entry("MC",   "CONSUMER_DISC"),     // LVMH (Paris)

            // Real estate
            Map.entry("AMT",  "REAL_ESTATE"),
            Map.entry("PLD",  "REAL_ESTATE"),
            Map.entry("CCI",  "REAL_ESTATE"),
            Map.entry("SPG",  "REAL_ESTATE")
    );

    public Optional<String> classify(String ticker) {
        return Optional.ofNullable(TICKER_TO_CATEGORY.get(ticker.toUpperCase()));
    }

    public String classifyOrUnknown(String ticker) {
        return TICKER_TO_CATEGORY.getOrDefault(ticker.toUpperCase(), null);
    }
}

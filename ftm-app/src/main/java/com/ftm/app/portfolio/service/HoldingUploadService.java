package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.domain.Holding;
import com.ftm.app.ingestion.client.FredClient;
import com.ftm.app.portfolio.repository.HoldingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;

@Service
public class HoldingUploadService {

    private static final Logger log = LoggerFactory.getLogger(HoldingUploadService.class);
    private static final BigDecimal FALLBACK_USD_PER_EUR = new BigDecimal("1.08");
    private static final String DEXUSEU = "DEXUSEU";

    private final HoldingRepository holdingRepository;
    private final HoldingClassificationService classificationService;
    private final FredClient fredClient;

    public HoldingUploadService(HoldingRepository holdingRepository,
                                HoldingClassificationService classificationService,
                                FredClient fredClient) {
        this.holdingRepository = holdingRepository;
        this.classificationService = classificationService;
        this.fredClient = fredClient;
    }

    public HoldingsUploadResponse upload(String csvContent) {
        List<String[]> rows = parseCsv(csvContent);
        boolean hasEurHoldings = rows.stream().anyMatch(r -> "EUR".equalsIgnoreCase(safeGet(r, 3)));

        BigDecimal usdPerEurRate = hasEurHoldings ? fetchUsdPerEurRate() : null;

        List<Holding> holdings = new ArrayList<>();
        List<String> unclassifiedTickers = new ArrayList<>();

        for (String[] row : rows) {
            if (row.length < 4) continue;
            String ticker    = safeGet(row, 0).toUpperCase();
            String name      = safeGet(row, 1);
            String currency  = safeGet(row, 3).toUpperCase();
            String quantityRaw  = safeGet(row, 2);
            String avgCostRaw   = safeGet(row, 4);

            if (ticker.isBlank()) continue;

            BigDecimal quantity  = parseDecimal(quantityRaw);
            BigDecimal avgCost   = parseDecimal(avgCostRaw);
            String categoryId    = classificationService.classifyOrUnknown(ticker);

            if (categoryId == null) {
                unclassifiedTickers.add(ticker);
            }

            BigDecimal fxRate = "EUR".equals(currency) ? usdPerEurRate : null;

            holdings.add(new Holding(null, ticker, name.isBlank() ? null : name,
                    categoryId, currency, quantity, avgCost, fxRate, null));
        }

        holdingRepository.replaceAll(holdings);
        log.info("Holdings upload: {} accepted, {} unclassified", holdings.size(), unclassifiedTickers.size());

        List<HoldingDto> holdingDtos = holdings.stream().map(h -> toDto(h, usdPerEurRate)).toList();
        BigDecimal totalMarketValueUsd = computeTotalMarketValueUsd(holdingDtos);

        return new HoldingsUploadResponse(holdings.size(), unclassifiedTickers, totalMarketValueUsd, usdPerEurRate, holdingDtos);
    }

    public List<HoldingDto> getHoldings() {
        return holdingRepository.findAll().stream().map(h -> toDto(h, null)).toList();
    }

    public HoldingDto updateHolding(String ticker, HoldingUpdateRequest request) {
        String upperTicker = ticker.toUpperCase();
        BigDecimal newAvgCost = request.avgCostLocal() != null
                ? request.avgCostLocal()
                : holdingRepository.findAll().stream()
                        .filter(h -> h.ticker().equals(upperTicker))
                        .findFirst()
                        .map(Holding::avgCostLocal)
                        .orElse(null);

        int updated = holdingRepository.updateByTicker(upperTicker, request.quantity(), newAvgCost);
        if (updated == 0) {
            throw new NoSuchElementException("No holding found for ticker: " + upperTicker);
        }
        Holding holding = holdingRepository.findAll().stream()
                .filter(h -> h.ticker().equals(upperTicker))
                .findFirst()
                .orElseThrow();
        return toDto(holding, null);
    }

    public String generateCsvTemplate() {
        return """
                ticker,name,quantity,currency,avg_cost
                XLK,Technology Select Sector SPDR Fund,10.0,USD,195.50
                RHM,Rheinmetall AG,5.0,EUR,1250.00
                TLT,iShares 20+ Year Treasury Bond ETF,20.0,USD,88.00
                GLD,SPDR Gold Shares,8.5,USD,210.00
                AAPL,Apple Inc.,15.0,USD,175.00
                """;
    }

    private BigDecimal fetchUsdPerEurRate() {
        try {
            LocalDate today = LocalDate.now();
            LocalDate from = today.minusDays(7);
            var observations = fredClient.fetchObservations(DEXUSEU, from, today);
            if (!observations.isEmpty()) {
                String valueStr = observations.getLast().value();
                BigDecimal rate = new BigDecimal(valueStr);
                log.info("USD/EUR rate from FRED: {}", rate);
                return rate;
            }
        } catch (Exception e) {
            log.warn("Could not fetch USD/EUR rate from FRED, using fallback {}: {}", FALLBACK_USD_PER_EUR, e.getMessage());
        }
        return FALLBACK_USD_PER_EUR;
    }

    private HoldingDto toDto(Holding holding, BigDecimal usdPerEurRateFallback) {
        BigDecimal fxRate = holding.usdFxRate() != null ? holding.usdFxRate() : usdPerEurRateFallback;
        BigDecimal marketValueUsd = null;
        if (holding.avgCostLocal() != null && holding.quantity() != null) {
            if ("EUR".equals(holding.currency()) && fxRate != null) {
                marketValueUsd = holding.quantity()
                        .multiply(holding.avgCostLocal())
                        .multiply(fxRate)
                        .setScale(2, RoundingMode.HALF_UP);
            } else if ("USD".equals(holding.currency())) {
                marketValueUsd = holding.quantity()
                        .multiply(holding.avgCostLocal())
                        .setScale(2, RoundingMode.HALF_UP);
            }
        }
        return new com.ftm.app.api.dto.HoldingDto(
                holding.ticker(), holding.name(), holding.categoryId(),
                holding.currency(), holding.quantity(), holding.avgCostLocal(),
                holding.usdFxRate(), marketValueUsd);
    }

    private BigDecimal computeTotalMarketValueUsd(List<HoldingDto> holdings) {
        return holdings.stream()
                .map(h -> h.marketValueUsd() != null ? h.marketValueUsd() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private List<String[]> parseCsv(String csv) {
        List<String[]> rows = new ArrayList<>();
        boolean firstLine = true;
        for (String line : csv.split("\\r?\\n")) {
            if (firstLine) { firstLine = false; continue; } // skip header
            if (line.isBlank()) continue;
            rows.add(line.split(",", -1));
        }
        return rows;
    }

    private String safeGet(String[] row, int index) {
        return index < row.length ? row[index].trim() : "";
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        try { return new BigDecimal(raw.trim()); }
        catch (NumberFormatException e) { return BigDecimal.ZERO; }
    }
}

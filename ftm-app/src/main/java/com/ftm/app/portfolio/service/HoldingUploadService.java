package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.domain.Holding;
import com.ftm.app.portfolio.domain.HoldingCsvRow;
import com.ftm.app.portfolio.repository.HoldingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class HoldingUploadService {

    private static final Logger log = LoggerFactory.getLogger(HoldingUploadService.class);

    private final HoldingRepository holdingRepository;
    private final HoldingClassificationService classificationService;
    private final HoldingCsvParser csvParser;
    private final HoldingPriceService holdingPriceService;

    public HoldingUploadService(
            HoldingRepository holdingRepository,
            HoldingClassificationService classificationService,
            HoldingCsvParser csvParser,
            HoldingPriceService holdingPriceService) {
        this.holdingRepository = holdingRepository;
        this.classificationService = classificationService;
        this.csvParser = csvParser;
        this.holdingPriceService = holdingPriceService;
    }

    public HoldingsUploadResponse upload(String csvContent) throws IOException {
        List<HoldingCsvRow> rows = csvParser.parse(csvContent);

        List<Holding> holdings = new ArrayList<>();
        List<String> unclassifiedTickers = new ArrayList<>();

        for (HoldingCsvRow row : rows) {
            String ticker = row.ticker().toUpperCase();
            if (ticker.isBlank()) continue;

            String currency = row.currency().toUpperCase();
            String categoryId = classificationService.classifyOrUnknown(ticker);

            if (categoryId == null) {
                unclassifiedTickers.add(ticker);
            }

            holdings.add(
                    new Holding(
                            null,
                            ticker,
                            row.name().isBlank() ? null : row.name(),
                            categoryId,
                            currency,
                            parseDecimal(row.quantity()),
                            parseDecimal(row.avgCost()),
                            null,
                            null,
                            null,
                            null,
                            null));
        }

        holdingRepository.replaceAll(holdings);
        log.info("Holdings upload: {} accepted, {} unclassified", holdings.size(), unclassifiedTickers.size());

        // Fetch live prices immediately after upload
        holdingPriceService.refreshPricesForAllHoldings();

        BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
        List<Holding> enrichedHoldings = holdingRepository.findAll();
        List<HoldingDto> holdingDtos = enrichedHoldings.stream()
                .map(h -> toDto(h, usdPerEurRate))
                .toList();

        BigDecimal totalMarketValueUsd = computeTotalMarketValueUsd(holdingDtos);
        BigDecimal totalMarketValueEur = computeTotalMarketValueEur(holdingDtos);

        return new HoldingsUploadResponse(
                holdings.size(), unclassifiedTickers, totalMarketValueUsd, usdPerEurRate, totalMarketValueEur, holdingDtos);
    }

    public List<HoldingDto> getHoldings() {
        BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
        return holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate)).toList();
    }

    public HoldingDto updateHolding(String ticker, HoldingUpdateRequest request) {
        String upperTicker = ticker.toUpperCase();
        BigDecimal newAvgCost =
                request.avgCostLocal() != null
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

        BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
        Holding holding = holdingRepository.findAll().stream()
                .filter(h -> h.ticker().equals(upperTicker))
                .findFirst()
                .orElseThrow();
        return toDto(holding, usdPerEurRate);
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

    private HoldingDto toDto(Holding holding, BigDecimal usdPerEurRate) {
        BigDecimal effectiveFxRate = holding.usdFxRate() != null ? holding.usdFxRate() : usdPerEurRate;

        BigDecimal priceForValue = holding.currentPriceLocal() != null
                ? holding.currentPriceLocal()
                : holding.avgCostLocal();

        BigDecimal marketValueUsd = computeMarketValueUsd(holding, priceForValue, effectiveFxRate);
        BigDecimal marketValueEur = computeMarketValueEur(holding, priceForValue, usdPerEurRate);

        return new HoldingDto(
                holding.ticker(),
                holding.name(),
                holding.categoryId(),
                holding.currency(),
                holding.quantity(),
                holding.avgCostLocal(),
                holding.usdFxRate(),
                marketValueUsd,
                holding.currentPriceLocal(),
                holding.priceDate(),
                holding.priceSource(),
                marketValueEur);
    }

    private BigDecimal computeMarketValueUsd(Holding holding, BigDecimal priceForValue, BigDecimal fxRate) {
        if (priceForValue == null || holding.quantity() == null) return null;
        if ("EUR".equals(holding.currency()) && fxRate != null) {
            return holding.quantity().multiply(priceForValue).multiply(fxRate).setScale(2, RoundingMode.HALF_UP);
        }
        if ("USD".equals(holding.currency())) {
            return holding.quantity().multiply(priceForValue).setScale(2, RoundingMode.HALF_UP);
        }
        return null;
    }

    private BigDecimal computeMarketValueEur(Holding holding, BigDecimal priceForValue, BigDecimal usdPerEurRate) {
        if (priceForValue == null || holding.quantity() == null) return null;
        if ("EUR".equals(holding.currency())) {
            return holding.quantity().multiply(priceForValue).setScale(2, RoundingMode.HALF_UP);
        }
        if ("USD".equals(holding.currency()) && usdPerEurRate != null) {
            return holding.quantity().multiply(priceForValue)
                    .divide(usdPerEurRate, 2, RoundingMode.HALF_UP);
        }
        return null;
    }

    private BigDecimal computeTotalMarketValueUsd(List<HoldingDto> holdings) {
        return holdings.stream()
                .map(h -> h.marketValueUsd() != null ? h.marketValueUsd() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal computeTotalMarketValueEur(List<HoldingDto> holdings) {
        return holdings.stream()
                .map(h -> h.marketValueEur() != null ? h.marketValueEur() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }
}

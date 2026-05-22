package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.CreateHoldingRequest;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.domain.CategoryId;
import com.ftm.app.domain.Holding;
import com.ftm.app.domain.Portfolio;
import com.ftm.app.portfolio.domain.HoldingCsvRow;
import com.ftm.app.portfolio.repository.HoldingRepository;
import com.ftm.app.portfolio.repository.PortfolioRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class HoldingUploadService {

  private static final Logger log = LoggerFactory.getLogger(HoldingUploadService.class);

  private final HoldingRepository holdingRepository;
  private final PortfolioRepository portfolioRepository;
  private final HoldingClassificationService classificationService;
  private final HoldingCsvParser csvParser;
  private final HoldingPriceService holdingPriceService;

  public HoldingUploadService(
      HoldingRepository holdingRepository,
      PortfolioRepository portfolioRepository,
      HoldingClassificationService classificationService,
      HoldingCsvParser csvParser,
      HoldingPriceService holdingPriceService) {
    this.holdingRepository = holdingRepository;
    this.portfolioRepository = portfolioRepository;
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
    log.info(
        "Holdings upload: {} accepted, {} unclassified",
        holdings.size(),
        unclassifiedTickers.size());

    // Fetch live prices immediately after upload
    holdingPriceService.refreshPricesForAllHoldings();

    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    List<Holding> enrichedHoldings = holdingRepository.findAll();
    List<HoldingDto> holdingDtos =
        enrichedHoldings.stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate)).toList();

    syncPortfolioAllocations(holdingDtos);

    BigDecimal totalMarketValueUsd = computeTotalMarketValueUsd(holdingDtos);
    BigDecimal totalMarketValueEur = computeTotalMarketValueEur(holdingDtos);

    return new HoldingsUploadResponse(
        holdings.size(),
        unclassifiedTickers,
        totalMarketValueUsd,
        usdPerEurRate,
        totalMarketValueEur,
        holdingDtos);
  }

  public List<HoldingDto> getHoldings() {
    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    return holdingRepository.findAll().stream()
        .map(h -> toDto(h, usdPerEurRate, gbpUsdRate))
        .toList();
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

    int updated;
    if (request.currentPriceLocal() != null) {
      updated =
          holdingRepository.updateByTickerWithManualPrice(
              upperTicker, request.quantity(), newAvgCost, request.currentPriceLocal());
    } else {
      updated = holdingRepository.updateByTicker(upperTicker, request.quantity(), newAvgCost);
    }
    if (updated == 0) {
      throw new NoSuchElementException("No holding found for ticker: " + upperTicker);
    }

    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    List<Holding> allHoldings = holdingRepository.findAll();
    List<HoldingDto> allDtos =
        allHoldings.stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate)).toList();
    syncPortfolioAllocations(allDtos);
    return allDtos.stream().filter(h -> h.ticker().equals(upperTicker)).findFirst().orElseThrow();
  }

  public void deleteHolding(String ticker) {
    String upperTicker = ticker.toUpperCase();
    int deleted = holdingRepository.deleteByTicker(upperTicker);
    if (deleted == 0) {
      throw new NoSuchElementException("No holding found for ticker: " + upperTicker);
    }
    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    List<HoldingDto> remainingDtos =
        holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate)).toList();
    syncPortfolioAllocations(remainingDtos);
  }

  public HoldingDto createHolding(CreateHoldingRequest request) {
    String ticker = request.ticker().toUpperCase().trim();
    String currency = request.currency().toUpperCase().trim();
    String categoryId =
        request.categoryId() != null && !request.categoryId().isBlank()
            ? request.categoryId().toUpperCase().trim()
            : classificationService.classifyOrUnknown(ticker);

    boolean alreadyExists =
        holdingRepository.findAll().stream().anyMatch(h -> h.ticker().equals(ticker));
    if (alreadyExists) {
      throw new IllegalArgumentException(
          "Holding already exists for ticker: " + ticker + " — use Edit to update it.");
    }

    Holding holding =
        new Holding(
            null,
            ticker,
            request.name() != null && !request.name().isBlank() ? request.name().trim() : null,
            categoryId,
            currency,
            request.quantity(),
            request.avgCostLocal(),
            null,
            null,
            null,
            null,
            null);

    holdingRepository.insertSingle(holding);
    log.info("Holding created: {} (category={})", ticker, categoryId);

    // Attempt live price fetch for the new holding
    holdingPriceService.refreshPricesForAllHoldings();

    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    List<HoldingDto> allDtos =
        holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate)).toList();
    syncPortfolioAllocations(allDtos);

    return allDtos.stream().filter(h -> h.ticker().equals(ticker)).findFirst().orElseThrow();
  }

  public List<HoldingDto> refreshPricesAndSyncAllocations() {
    holdingPriceService.refreshPricesForAllHoldings();
    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    List<HoldingDto> holdingDtos =
        holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate)).toList();
    syncPortfolioAllocations(holdingDtos);
    return holdingDtos;
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

  private HoldingDto toDto(Holding holding, BigDecimal usdPerEurRate, BigDecimal gbpUsdRate) {
    BigDecimal effectiveFxRate;
    if (holding.usdFxRate() != null) {
      effectiveFxRate = holding.usdFxRate();
    } else if ("GBP".equalsIgnoreCase(holding.currency())) {
      effectiveFxRate = gbpUsdRate;
    } else {
      effectiveFxRate = usdPerEurRate;
    }

    BigDecimal priceForValue =
        holding.currentPriceLocal() != null ? holding.currentPriceLocal() : holding.avgCostLocal();

    BigDecimal marketValueUsd = computeMarketValueUsd(holding, priceForValue, effectiveFxRate);
    BigDecimal marketValueEur =
        computeMarketValueEur(holding, priceForValue, usdPerEurRate, gbpUsdRate);

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

  private BigDecimal computeMarketValueUsd(
      Holding holding, BigDecimal priceForValue, BigDecimal fxRate) {
    if (priceForValue == null || holding.quantity() == null) return null;
    String currency = holding.currency() == null ? "" : holding.currency().toUpperCase();
    if ("USD".equals(currency)) {
      return holding.quantity().multiply(priceForValue).setScale(2, RoundingMode.HALF_UP);
    }
    if (fxRate != null) {
      // EUR, GBP, or any currency with a resolved USD rate
      return holding
          .quantity()
          .multiply(priceForValue)
          .multiply(fxRate)
          .setScale(2, RoundingMode.HALF_UP);
    }
    return null;
  }

  private BigDecimal computeMarketValueEur(
      Holding holding, BigDecimal priceForValue, BigDecimal usdPerEurRate, BigDecimal gbpUsdRate) {
    if (priceForValue == null || holding.quantity() == null) return null;
    String currency = holding.currency() == null ? "" : holding.currency().toUpperCase();
    if ("EUR".equals(currency)) {
      return holding.quantity().multiply(priceForValue).setScale(2, RoundingMode.HALF_UP);
    }
    if ("USD".equals(currency) && usdPerEurRate != null) {
      return holding
          .quantity()
          .multiply(priceForValue)
          .divide(usdPerEurRate, 2, RoundingMode.HALF_UP);
    }
    if ("GBP".equals(currency) && gbpUsdRate != null && usdPerEurRate != null) {
      return holding
          .quantity()
          .multiply(priceForValue)
          .multiply(gbpUsdRate)
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

  private void syncPortfolioAllocations(List<HoldingDto> holdings) {
    Map<String, BigDecimal> valueByCategory = new LinkedHashMap<>();
    for (HoldingDto holding : holdings) {
      String catId = holding.categoryId();
      if (catId == null || !isKnownCategoryId(catId)) continue;
      BigDecimal value = holding.marketValueEur();
      if (value == null) continue;
      valueByCategory.merge(catId, value, BigDecimal::add);
    }

    BigDecimal total = valueByCategory.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    if (total.compareTo(BigDecimal.ZERO) == 0) return;

    List<Portfolio> entries = new ArrayList<>();
    BigDecimal allocated = BigDecimal.ZERO;
    List<String> keys = new ArrayList<>(valueByCategory.keySet());

    for (int i = 0; i < keys.size(); i++) {
      String catId = keys.get(i);
      BigDecimal pct;
      if (i == keys.size() - 1) {
        pct = new BigDecimal("100.00").subtract(allocated);
      } else {
        pct =
            valueByCategory
                .get(catId)
                .multiply(new BigDecimal("100"))
                .divide(total, 2, RoundingMode.HALF_UP);
        allocated = allocated.add(pct);
      }
      entries.add(new Portfolio(CategoryId.valueOf(catId), pct, null, null));
    }

    portfolioRepository.replaceAll(entries);
    log.info("Portfolio allocations synced: {} categories", entries.size());
  }

  private boolean isKnownCategoryId(String id) {
    try {
      CategoryId.valueOf(id);
      return true;
    } catch (IllegalArgumentException e) {
      return false;
    }
  }
}

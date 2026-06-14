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
  private final PortfolioSnapshotService portfolioSnapshotService;

  public HoldingUploadService(
      HoldingRepository holdingRepository,
      PortfolioRepository portfolioRepository,
      HoldingClassificationService classificationService,
      HoldingCsvParser csvParser,
      HoldingPriceService holdingPriceService,
      PortfolioSnapshotService portfolioSnapshotService) {
    this.holdingRepository = holdingRepository;
    this.portfolioRepository = portfolioRepository;
    this.classificationService = classificationService;
    this.csvParser = csvParser;
    this.holdingPriceService = holdingPriceService;
    this.portfolioSnapshotService = portfolioSnapshotService;
  }

  public HoldingsUploadResponse upload(String csvContent) throws IOException {
    List<HoldingCsvRow> rows = csvParser.parse(csvContent);

    List<Holding> holdings = new ArrayList<>();
    List<String> unclassifiedTickers = new ArrayList<>();

    for (HoldingCsvRow row : rows) {
      String ticker = row.ticker().toUpperCase();
      if (ticker.isBlank()) continue;

      // Normalize GBX (pence) → GBP so the DB stores a consistent currency code.
      // Prices remain in pence; the pence→GBP division is applied during value computation.
      String currency = "GBX".equalsIgnoreCase(row.currency()) ? "GBX" : row.currency().toUpperCase();
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
    BigDecimal sekUsdRate = holdingPriceService.fetchSekUsdRate();
    List<Holding> enrichedHoldings = holdingRepository.findAll();
    List<HoldingDto> holdingDtos =
        enrichedHoldings.stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate, sekUsdRate)).toList();

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
    BigDecimal sekUsdRate = holdingPriceService.fetchSekUsdRate();
    return holdingRepository.findAll().stream()
        .map(h -> toDto(h, usdPerEurRate, gbpUsdRate, sekUsdRate))
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
    BigDecimal sekUsdRate = holdingPriceService.fetchSekUsdRate();
    List<Holding> allHoldings = holdingRepository.findAll();
    List<HoldingDto> allDtos =
        allHoldings.stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate, sekUsdRate)).toList();
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
    BigDecimal sekUsdRate = holdingPriceService.fetchSekUsdRate();
    List<HoldingDto> remainingDtos =
        holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate, sekUsdRate)).toList();
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
    BigDecimal sekUsdRate = holdingPriceService.fetchSekUsdRate();
    List<HoldingDto> allDtos =
        holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate, sekUsdRate)).toList();
    syncPortfolioAllocations(allDtos);

    return allDtos.stream().filter(h -> h.ticker().equals(ticker)).findFirst().orElseThrow();
  }

  public List<HoldingDto> refreshPricesAndSyncAllocations() {
    holdingPriceService.refreshPricesForAllHoldings();
    syncMissingCategoryIds();
    BigDecimal usdPerEurRate = holdingPriceService.fetchUsdPerEurRate();
    BigDecimal gbpUsdRate = holdingPriceService.fetchGbpUsdRate();
    BigDecimal sekUsdRate = holdingPriceService.fetchSekUsdRate();
    List<HoldingDto> holdingDtos =
        holdingRepository.findAll().stream().map(h -> toDto(h, usdPerEurRate, gbpUsdRate, sekUsdRate)).toList();
    syncPortfolioAllocations(holdingDtos);
    portfolioSnapshotService.captureSnapshot(holdingDtos);
    return holdingDtos;
  }

  private void syncMissingCategoryIds() {
    holdingRepository.findAll().stream()
        .filter(h -> h.categoryId() == null)
        .forEach(
            h -> {
              classificationService
                  .classify(h.ticker())
                  .ifPresent(
                      categoryId -> {
                        int updated = holdingRepository.updateCategoryId(h.ticker(), categoryId);
                        if (updated > 0) {
                          log.info(
                              "category re-synced for holding ticker={} → {}",
                              h.ticker(),
                              categoryId);
                        }
                      });
            });
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

  private HoldingDto toDto(
      Holding holding, BigDecimal usdPerEurRate, BigDecimal gbpUsdRate, BigDecimal sekUsdRate) {
    String currency = holding.currency() == null ? "" : holding.currency().toUpperCase();

    BigDecimal rawPrice =
        holding.currentPriceLocal() != null ? holding.currentPriceLocal() : holding.avgCostLocal();

    // GBX = British pence. Yahoo Finance prices for .L tickers are in pence.
    // Divide by 100 to normalize to GBP, then treat as GBP for FX conversion.
    boolean isGbx = "GBX".equals(currency);
    BigDecimal normalizedPrice =
        (isGbx && rawPrice != null)
            ? rawPrice.divide(BigDecimal.valueOf(100), 6, java.math.RoundingMode.HALF_UP)
            : rawPrice;
    String normalizedCurrency = isGbx ? "GBP" : currency;

    BigDecimal effectiveFxRate;
    if (holding.usdFxRate() != null) {
      effectiveFxRate = holding.usdFxRate();
    } else if ("GBP".equals(normalizedCurrency)) {
      effectiveFxRate = gbpUsdRate;
    } else if ("SEK".equals(normalizedCurrency)) {
      effectiveFxRate = sekUsdRate;
    } else {
      effectiveFxRate = usdPerEurRate;
    }

    BigDecimal marketValueUsd =
        computeMarketValueUsd(holding, normalizedPrice, normalizedCurrency, effectiveFxRate);
    BigDecimal marketValueEur =
        computeMarketValueEur(
            holding, normalizedPrice, normalizedCurrency, usdPerEurRate, gbpUsdRate, sekUsdRate);

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
      Holding holding, BigDecimal priceForValue, String normalizedCurrency, BigDecimal fxRate) {
    if (priceForValue == null || holding.quantity() == null) return null;
    if ("USD".equals(normalizedCurrency)) {
      return holding.quantity().multiply(priceForValue).setScale(2, RoundingMode.HALF_UP);
    }
    if (fxRate != null) {
      // EUR, GBP (already normalized from GBX), SEK — multiply by the resolved USD rate
      return holding
          .quantity()
          .multiply(priceForValue)
          .multiply(fxRate)
          .setScale(2, RoundingMode.HALF_UP);
    }
    return null;
  }

  private BigDecimal computeMarketValueEur(
      Holding holding,
      BigDecimal priceForValue,
      String normalizedCurrency,
      BigDecimal usdPerEurRate,
      BigDecimal gbpUsdRate,
      BigDecimal sekUsdRate) {
    if (priceForValue == null || holding.quantity() == null) return null;
    if ("EUR".equals(normalizedCurrency)) {
      return holding.quantity().multiply(priceForValue).setScale(2, RoundingMode.HALF_UP);
    }
    if ("USD".equals(normalizedCurrency) && usdPerEurRate != null) {
      return holding
          .quantity()
          .multiply(priceForValue)
          .divide(usdPerEurRate, 2, RoundingMode.HALF_UP);
    }
    if ("GBP".equals(normalizedCurrency) && gbpUsdRate != null && usdPerEurRate != null) {
      // Price already normalized from GBX pence → GBP before this method is called
      return holding
          .quantity()
          .multiply(priceForValue)
          .multiply(gbpUsdRate)
          .divide(usdPerEurRate, 2, RoundingMode.HALF_UP);
    }
    if ("SEK".equals(normalizedCurrency) && sekUsdRate != null && usdPerEurRate != null) {
      return holding
          .quantity()
          .multiply(priceForValue)
          .multiply(sekUsdRate)
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

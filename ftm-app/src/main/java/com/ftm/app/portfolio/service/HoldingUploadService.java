package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.CreateHoldingRequest;
import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.api.dto.HoldingUpdateRequest;
import com.ftm.app.api.dto.HoldingsUploadResponse;
import com.ftm.app.domain.Holding;
import com.ftm.app.domain.Portfolio;
import com.ftm.app.portfolio.domain.HoldingCsvRow;
import com.ftm.app.portfolio.repository.HoldingRepository;
import com.ftm.app.portfolio.repository.PortfolioRepository;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.NoSuchElementException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Owns the user's holdings: uploading them from CSV, editing them one at a time, and refreshing
 * their prices. Every change re-values the portfolio and re-syncs the category allocations, so the
 * target weights always reflect what is actually held.
 */
@Service
public class HoldingUploadService {

  private static final Logger log = LoggerFactory.getLogger(HoldingUploadService.class);

  private static final String CSV_TEMPLATE =
      """
      ticker,name,quantity,currency,avg_cost
      XLK,Technology Select Sector SPDR Fund,10.0,USD,195.50
      RHM,Rheinmetall AG,5.0,EUR,1250.00
      TLT,iShares 20+ Year Treasury Bond ETF,20.0,USD,88.00
      GLD,SPDR Gold Shares,8.5,USD,210.00
      AAPL,Apple Inc.,15.0,USD,175.00
      """;

  private final HoldingRepository holdingRepository;
  private final PortfolioRepository portfolioRepository;
  private final HoldingClassificationService classificationService;
  private final HoldingCsvParser csvParser;
  private final HoldingPriceService holdingPriceService;
  private final PortfolioSnapshotService portfolioSnapshotService;
  private final HoldingValuationCalculator valuationCalculator;
  private final PortfolioAllocationCalculator allocationCalculator;

  public HoldingUploadService(
      HoldingRepository holdingRepository,
      PortfolioRepository portfolioRepository,
      HoldingClassificationService classificationService,
      HoldingCsvParser csvParser,
      HoldingPriceService holdingPriceService,
      PortfolioSnapshotService portfolioSnapshotService,
      HoldingValuationCalculator valuationCalculator,
      PortfolioAllocationCalculator allocationCalculator) {
    this.holdingRepository = holdingRepository;
    this.portfolioRepository = portfolioRepository;
    this.classificationService = classificationService;
    this.csvParser = csvParser;
    this.holdingPriceService = holdingPriceService;
    this.portfolioSnapshotService = portfolioSnapshotService;
    this.valuationCalculator = valuationCalculator;
    this.allocationCalculator = allocationCalculator;
  }

  public HoldingsUploadResponse upload(String csvContent) throws IOException {
    List<String> unclassifiedTickers = new ArrayList<>();
    List<Holding> holdings = new ArrayList<>();

    for (HoldingCsvRow row : csvParser.parse(csvContent)) {
      String ticker = row.ticker().toUpperCase();
      if (ticker.isBlank()) continue;
      String categoryId = classificationService.classifyOrUnknown(ticker);
      if (categoryId == null) unclassifiedTickers.add(ticker);
      holdings.add(toHolding(row, ticker, categoryId));
    }

    holdingRepository.replaceAll(holdings);
    log.info(
        "Holdings upload: {} accepted, {} unclassified",
        holdings.size(),
        unclassifiedTickers.size());

    holdingPriceService.refreshPricesForAllHoldings();

    ExchangeRates rates = ExchangeRates.fetchFrom(holdingPriceService);
    List<HoldingDto> valued = valueAllHoldings(rates);
    syncPortfolioAllocations(valued);

    return new HoldingsUploadResponse(
        holdings.size(),
        unclassifiedTickers,
        valuationCalculator.totalMarketValueUsd(valued),
        rates.usdPerEur(),
        valuationCalculator.totalMarketValueEur(valued),
        valued);
  }

  /**
   * GBX (pence) is kept as-is on the row so the stored currency matches the price the provider
   * quotes; the pence→GBP conversion happens when the holding is valued.
   */
  private Holding toHolding(HoldingCsvRow row, String ticker, String categoryId) {
    return new Holding(
        null,
        ticker,
        row.name().isBlank() ? null : row.name(),
        categoryId,
        row.currency().toUpperCase(),
        parseDecimal(row.quantity()),
        parseDecimal(row.avgCost()),
        null,
        null,
        null,
        null,
        null);
  }

  public List<HoldingDto> getHoldings() {
    return valueAllHoldings(ExchangeRates.fetchFrom(holdingPriceService));
  }

  public HoldingDto updateHolding(String ticker, HoldingUpdateRequest request) {
    String upperTicker = ticker.toUpperCase();
    BigDecimal newAvgCost =
        request.avgCostLocal() != null ? request.avgCostLocal() : currentAvgCost(upperTicker);

    int updated =
        request.currentPriceLocal() != null
            ? holdingRepository.updateByTickerWithManualPrice(
                upperTicker, request.quantity(), newAvgCost, request.currentPriceLocal())
            : holdingRepository.updateByTicker(upperTicker, request.quantity(), newAvgCost);
    if (updated == 0) {
      throw new NoSuchElementException("No holding found for ticker: " + upperTicker);
    }

    return revalueAndFind(upperTicker);
  }

  public void deleteHolding(String ticker) {
    String upperTicker = ticker.toUpperCase();
    if (holdingRepository.deleteByTicker(upperTicker) == 0) {
      throw new NoSuchElementException("No holding found for ticker: " + upperTicker);
    }
    syncPortfolioAllocations(valueAllHoldings(ExchangeRates.fetchFrom(holdingPriceService)));
  }

  public HoldingDto createHolding(CreateHoldingRequest request) {
    String ticker = request.ticker().toUpperCase().trim();
    String categoryId = requestedCategoryOrClassified(request, ticker);

    if (holdingRepository.findAll().stream().anyMatch(h -> h.ticker().equals(ticker))) {
      throw new IllegalArgumentException(
          "Holding already exists for ticker: " + ticker + " — use Edit to update it.");
    }

    holdingRepository.insertSingle(
        new Holding(
            null,
            ticker,
            request.name() != null && !request.name().isBlank() ? request.name().trim() : null,
            categoryId,
            request.currency().toUpperCase().trim(),
            request.quantity(),
            request.avgCostLocal(),
            null,
            null,
            null,
            null,
            null));
    log.info("Holding created: {} (category={})", ticker, categoryId);

    holdingPriceService.refreshPricesForAllHoldings();
    return revalueAndFind(ticker);
  }

  private String requestedCategoryOrClassified(CreateHoldingRequest request, String ticker) {
    return request.categoryId() != null && !request.categoryId().isBlank()
        ? request.categoryId().toUpperCase().trim()
        : classificationService.classifyOrUnknown(ticker);
  }

  public List<HoldingDto> refreshPricesAndSyncAllocations() {
    holdingPriceService.refreshPricesForAllHoldings();
    resyncHoldingCategories();

    List<HoldingDto> valued = valueAllHoldings(ExchangeRates.fetchFrom(holdingPriceService));
    syncPortfolioAllocations(valued);
    portfolioSnapshotService.captureSnapshot(valued);
    return valued;
  }

  /**
   * Re-syncs every holding's stored category against the current ticker→category map. A holding is
   * updated when its ticker resolves to a category different from what is stored — covering both
   * the never-classified case (null category, uploaded before the mapping existed) and the
   * correction case (a mapping was later fixed, e.g. SPCE moved from TECH to INDU_ADEF). Tickers
   * with no mapping are left untouched and not counted.
   *
   * @return the number of holdings whose category changed
   */
  public int resyncHoldingCategories() {
    return (int)
        holdingRepository.findAll().stream()
            .filter(
                holding ->
                    classificationService
                        .classify(holding.ticker())
                        .filter(categoryId -> !categoryId.equals(holding.categoryId()))
                        .map(categoryId -> applyCategory(holding, categoryId))
                        .orElse(false))
            .count();
  }

  private boolean applyCategory(Holding holding, String categoryId) {
    if (holdingRepository.updateCategoryId(holding.ticker(), categoryId) == 0) return false;
    log.info(
        "category re-synced for holding ticker={} : {} → {}",
        holding.ticker(),
        holding.categoryId(),
        categoryId);
    return true;
  }

  public String generateCsvTemplate() {
    return CSV_TEMPLATE;
  }

  /** Every stored holding, valued at the given rates. */
  private List<HoldingDto> valueAllHoldings(ExchangeRates rates) {
    return holdingRepository.findAll().stream()
        .map(holding -> valuationCalculator.toDto(holding, rates))
        .toList();
  }

  /** Re-values everything after a change, re-syncs the allocations, and returns the changed row. */
  private HoldingDto revalueAndFind(String ticker) {
    List<HoldingDto> valued = valueAllHoldings(ExchangeRates.fetchFrom(holdingPriceService));
    syncPortfolioAllocations(valued);
    return valued.stream()
        .filter(holding -> holding.ticker().equals(ticker))
        .findFirst()
        .orElseThrow();
  }

  private BigDecimal currentAvgCost(String ticker) {
    return holdingRepository.findAll().stream()
        .filter(holding -> holding.ticker().equals(ticker))
        .findFirst()
        .map(Holding::avgCostLocal)
        .orElse(null);
  }

  private void syncPortfolioAllocations(List<HoldingDto> holdings) {
    List<Portfolio> allocations = allocationCalculator.computeAllocations(holdings);
    if (allocations.isEmpty()) return;
    portfolioRepository.replaceAll(allocations);
    log.info("Portfolio allocations synced: {} categories", allocations.size());
  }

  private BigDecimal parseDecimal(String raw) {
    if (raw == null || raw.isBlank()) return BigDecimal.ZERO;
    try {
      return new BigDecimal(raw.trim());
    } catch (NumberFormatException notANumber) {
      return BigDecimal.ZERO;
    }
  }
}

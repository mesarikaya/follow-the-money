package com.ftm.app.portfolio.service;

import com.ftm.app.api.dto.HoldingDto;
import com.ftm.app.portfolio.domain.PortfolioValueSnapshot;
import com.ftm.app.portfolio.repository.PortfolioSnapshotRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PortfolioSnapshotService {

  private static final Logger log = LoggerFactory.getLogger(PortfolioSnapshotService.class);

  private final PortfolioSnapshotRepository snapshotRepository;
  private final HoldingPriceService holdingPriceService;

  public PortfolioSnapshotService(
      PortfolioSnapshotRepository snapshotRepository, HoldingPriceService holdingPriceService) {
    this.snapshotRepository = snapshotRepository;
    this.holdingPriceService = holdingPriceService;
  }

  public void captureSnapshot(List<HoldingDto> holdings) {
    if (holdings.isEmpty()) return;

    BigDecimal totalValueEur =
        holdings.stream()
            .map(h -> h.marketValueEur() != null ? h.marketValueEur() : BigDecimal.ZERO)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

    if (totalValueEur.compareTo(BigDecimal.ZERO) == 0) return;

    BigDecimal totalCostEur = computeTotalCostEur(holdings);

    PortfolioValueSnapshot snapshot =
        new PortfolioValueSnapshot(LocalDate.now(), totalValueEur, totalCostEur, holdings.size());

    snapshotRepository.upsertSnapshot(snapshot);
    log.info(
        "Portfolio snapshot captured: date={}, value=€{}, holdings={}",
        snapshot.snapshotDate(),
        totalValueEur.toPlainString(),
        holdings.size());

    captureFxRates();
  }

  public List<PortfolioValueSnapshot> getRecentSnapshots(int days) {
    return snapshotRepository.findRecentSnapshots(days);
  }

  private void captureFxRates() {
    LocalDate today = LocalDate.now();
    try {
      BigDecimal usdPerEur = holdingPriceService.fetchUsdPerEurRate();
      snapshotRepository.upsertFxRate(today, "USD_PER_EUR", usdPerEur, "FRED");
    } catch (Exception e) {
      log.warn("Could not store USD/EUR rate snapshot: {}", e.getMessage());
    }
    try {
      BigDecimal gbpUsd = holdingPriceService.fetchGbpUsdRate();
      snapshotRepository.upsertFxRate(today, "GBP_USD", gbpUsd, "YAHOO");
    } catch (Exception e) {
      log.warn("Could not store GBP/USD rate snapshot: {}", e.getMessage());
    }
    try {
      BigDecimal sekUsd = holdingPriceService.fetchSekUsdRate();
      snapshotRepository.upsertFxRate(today, "SEK_USD", sekUsd, "YAHOO");
    } catch (Exception e) {
      log.warn("Could not store SEK/USD rate snapshot: {}", e.getMessage());
    }
  }

  private BigDecimal computeTotalCostEur(List<HoldingDto> holdings) {
    BigDecimal total = BigDecimal.ZERO;
    for (HoldingDto h : holdings) {
      if (h.avgCostLocal() == null || h.quantity() == null || h.marketValueEur() == null) continue;
      // Derive cost basis in EUR using the same ratio as market value
      // (cost/price) × marketValueEur gives cost in EUR without needing FX rates again
      if (h.currentPriceLocal() != null && h.currentPriceLocal().compareTo(BigDecimal.ZERO) > 0) {
        BigDecimal costRatio =
            h.avgCostLocal().divide(h.currentPriceLocal(), 8, java.math.RoundingMode.HALF_UP);
        total = total.add(h.marketValueEur().multiply(costRatio));
      }
    }
    return total.setScale(2, java.math.RoundingMode.HALF_UP);
  }
}

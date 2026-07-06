package com.ftm.app.portfolio.service;

import com.ftm.app.backtest.service.MomentumScoreComputer;
import com.ftm.app.ingestion.repository.RawPriceRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Computes the current 12-1 (skip-month) momentum score for every category from stored prices, using
 * the same {@link MomentumScoreComputer} that was validated in the backtest — so the live portfolio
 * recommendations rank sectors on the identical signal that beat the composite out-of-sample.
 *
 * <p>Thin orchestration only: it fetches a buffered price history (wide enough to form the 252-day
 * lookback) and delegates the maths to the pure computer, keeping this class trivially testable.
 */
@Service
public class LiveMomentumScoreService {

  static final int LOOKBACK_TRADING_DAYS = 252;
  static final int SKIP_TRADING_DAYS = 21;

  // Calendar buffer wide enough to cover 252 trading days of leading history before the latest date.
  static final int PRICE_HISTORY_BUFFER_DAYS = 420;

  private final RawPriceRepository rawPriceRepository;
  private final MomentumScoreComputer momentumScoreComputer;

  public LiveMomentumScoreService(
      RawPriceRepository rawPriceRepository, MomentumScoreComputer momentumScoreComputer) {
    this.rawPriceRepository = rawPriceRepository;
    this.momentumScoreComputer = momentumScoreComputer;
  }

  /**
   * Latest 12-1 momentum per category (higher = stronger); empty if there is no price data or not yet
   * enough history to form the 12-month lookback.
   */
  public Map<String, BigDecimal> computeLatestMomentumByCategoryId() {
    Optional<LocalDate> latestDate = rawPriceRepository.findMaxTradeDate();
    if (latestDate.isEmpty()) {
      return Map.of();
    }

    LocalDate asOf = latestDate.get();
    NavigableMap<LocalDate, Map<String, BigDecimal>> priceHistory =
        rawPriceRepository.findAdjCloseHistory(asOf.minusDays(PRICE_HISTORY_BUFFER_DAYS), asOf);

    return momentumScoreComputer
        .computeMomentumScores(
            List.of(asOf), priceHistory, LOOKBACK_TRADING_DAYS, SKIP_TRADING_DAYS)
        .getOrDefault(asOf, Map.of());
  }
}

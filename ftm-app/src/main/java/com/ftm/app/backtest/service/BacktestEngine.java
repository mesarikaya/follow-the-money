package com.ftm.app.backtest.service;

import static com.ftm.app.backtest.service.PortfolioSimulator.INITIAL_PORTFOLIO_VALUE;

import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import com.ftm.app.api.dto.BacktestResult.RebalanceEvent;
import com.ftm.app.backtest.repository.BacktestMarketDataRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Runs one backtest, in order: read the market data, decide when to rebalance, score the universe,
 * pick the allocations, simulate the resulting portfolio, and report the statistics. The maths lives
 * in the collaborators — this class is the recipe.
 */
@Service
public class BacktestEngine {

  private static final Logger log = LoggerFactory.getLogger(BacktestEngine.class);

  // Trailing 200-trading-day moving average for the absolute-momentum regime filter, with a
  // calendar buffer wide enough to cover ~200 trading days of history before the backtest start.
  private static final int TREND_FILTER_MA_DAYS = 200;
  private static final int TREND_FILTER_LOOKBACK_BUFFER_DAYS = 400;

  // Classic 12-1 momentum (Jegadeesh-Titman / Asness): a ~12-month (252-trading-day) lookback that
  // skips the most recent ~1 month (21 trading days) to sidestep short-term reversal. The calendar
  // buffer must comfortably cover 252 trading days of leading history before the first score date.
  private static final String SIGNAL_SOURCE_MOMENTUM_12_1 = "MOMENTUM_12_1";
  private static final int MOMENTUM_LOOKBACK_TRADING_DAYS = 252;
  private static final int MOMENTUM_SKIP_TRADING_DAYS = 21;
  private static final int MOMENTUM_LOOKBACK_BUFFER_DAYS = 420;

  private final BacktestMarketDataRepository marketDataRepository;
  private final AllocationComputer allocationComputer;
  private final MarketRegimeFilter marketRegimeFilter;
  private final MomentumScoreComputer momentumScoreComputer;
  private final PortfolioSimulator portfolioSimulator;
  private final BacktestStatisticsCalculator statisticsCalculator;

  public BacktestEngine(
      BacktestMarketDataRepository marketDataRepository,
      AllocationComputer allocationComputer,
      MarketRegimeFilter marketRegimeFilter,
      MomentumScoreComputer momentumScoreComputer,
      PortfolioSimulator portfolioSimulator,
      BacktestStatisticsCalculator statisticsCalculator) {
    this.marketDataRepository = marketDataRepository;
    this.allocationComputer = allocationComputer;
    this.marketRegimeFilter = marketRegimeFilter;
    this.momentumScoreComputer = momentumScoreComputer;
    this.portfolioSimulator = portfolioSimulator;
    this.statisticsCalculator = statisticsCalculator;
  }

  public BacktestResult run(BacktestRequest request) {
    log.info(
        "Running backtest: {} to {}, rebalance={}, topN={}",
        request.startDate(),
        request.endDate(),
        request.rebalanceFrequency(),
        request.topN());

    List<LocalDate> tradingDates =
        marketDataRepository.fetchTradingDates(request.startDate(), request.endDate());
    if (tradingDates.isEmpty()) {
      throw new IllegalArgumentException("No price data found for the requested date range.");
    }

    List<LocalDate> rebalanceDates =
        computeRebalanceDates(tradingDates, request.rebalanceFrequency());

    Map<LocalDate, Map<String, BigDecimal>> signalScoresByDate =
        resolveSignalScores(request, rebalanceDates);
    if (signalScoresByDate.isEmpty()) {
      throw new IllegalArgumentException(
          "No selection scores found for the date range. Run signal computation first (or widen the"
              + " range so 12-1 momentum has enough leading price history).");
    }

    Map<LocalDate, Map<String, BigDecimal>> pricesByDate =
        marketDataRepository.fetchEtfPricesByDate(request.startDate(), request.endDate());
    Map<LocalDate, BigDecimal> spyPricesByDate =
        marketDataRepository.fetchSpyPricesByDate(request.startDate(), request.endDate());

    Set<String> categoriesWithPriceData = categoriesWithPriceData(pricesByDate);

    Map<LocalDate, List<String>> allocationsByRebalanceDate =
        selectAllocations(request, rebalanceDates, signalScoresByDate, categoriesWithPriceData);

    List<EquityCurvePoint> equityCurve =
        portfolioSimulator.simulate(
            tradingDates,
            allocationsByRebalanceDate,
            pricesByDate,
            spyPricesByDate,
            request.transactionCostBps());

    List<EquityCurvePoint> equalWeightCurve =
        simulateEqualWeightBenchmark(
            tradingDates,
            rebalanceDates,
            signalScoresByDate,
            categoriesWithPriceData,
            pricesByDate,
            spyPricesByDate);

    List<RebalanceEvent> rebalanceHistory =
        toRebalanceHistory(allocationsByRebalanceDate, equityCurve);

    return statisticsCalculator.computeStatistics(
        request, equityCurve, equalWeightCurve, rebalanceHistory, tradingDates.size());
  }

  /**
   * Only allocate to categories that have at least one price in the range — sub-sector ETFs (KBE,
   * XBI, etc.) may not have been ingested, which would flatline the portfolio if selected.
   */
  private Set<String> categoriesWithPriceData(
      Map<LocalDate, Map<String, BigDecimal>> pricesByDate) {
    Set<String> categoryIds = new HashSet<>();
    pricesByDate.values().forEach(pricesForDate -> categoryIds.addAll(pricesForDate.keySet()));
    return categoryIds;
  }

  private Map<LocalDate, List<String>> selectAllocations(
      BacktestRequest request,
      List<LocalDate> rebalanceDates,
      Map<LocalDate, Map<String, BigDecimal>> signalScoresByDate,
      Set<String> categoriesWithPriceData) {
    Map<LocalDate, List<String>> allocations =
        allocationComputer.computeAllocations(
            rebalanceDates,
            signalScoresByDate,
            request.topN(),
            request.signalThreshold(),
            categoriesWithPriceData,
            request.invertSignal());
    return request.trendFilter()
        ? applyTrendFilter(allocations, request.startDate(), request.endDate())
        : allocations;
  }

  /**
   * Equal-weight benchmark: hold every in-scope category with price data, equal-weighted, on the
   * same rebalance schedule and with no trading cost. It answers "does the signal beat naive
   * diversification?" — selecting a large N here yields the full investable set.
   */
  private List<EquityCurvePoint> simulateEqualWeightBenchmark(
      List<LocalDate> tradingDates,
      List<LocalDate> rebalanceDates,
      Map<LocalDate, Map<String, BigDecimal>> signalScoresByDate,
      Set<String> categoriesWithPriceData,
      Map<LocalDate, Map<String, BigDecimal>> pricesByDate,
      Map<LocalDate, BigDecimal> spyPricesByDate) {
    Map<LocalDate, List<String>> equalWeightAllocations =
        allocationComputer.computeAllocations(
            rebalanceDates, signalScoresByDate, Integer.MAX_VALUE, null, categoriesWithPriceData);
    return portfolioSimulator.simulate(
        tradingDates, equalWeightAllocations, pricesByDate, spyPricesByDate, 0);
  }

  private List<RebalanceEvent> toRebalanceHistory(
      Map<LocalDate, List<String>> allocationsByRebalanceDate, List<EquityCurvePoint> equityCurve) {
    Map<LocalDate, Double> portfolioValueByDate = new HashMap<>();
    for (EquityCurvePoint point : equityCurve) {
      portfolioValueByDate.put(point.date(), point.portfolioValue());
    }
    return allocationsByRebalanceDate.entrySet().stream()
        .filter(entry -> !entry.getValue().isEmpty())
        .map(
            entry ->
                new RebalanceEvent(
                    entry.getKey(),
                    entry.getValue(),
                    portfolioValueByDate.getOrDefault(entry.getKey(), INITIAL_PORTFOLIO_VALUE)))
        .sorted(Comparator.comparing(RebalanceEvent::date))
        .toList();
  }

  /**
   * Resolves the per-rebalance selection scores for the requested signal source. Defaults to the
   * theory-model {@code COMPOSITE}; {@code MOMENTUM_12_1} instead derives classic 12-1 momentum from
   * a buffered price history and restricts it to the same category scope, so the two sources are
   * evaluated on an identical universe.
   */
  private Map<LocalDate, Map<String, BigDecimal>> resolveSignalScores(
      BacktestRequest request, List<LocalDate> scoreDates) {
    if (!SIGNAL_SOURCE_MOMENTUM_12_1.equalsIgnoreCase(request.signalSource())) {
      return marketDataRepository.fetchCompositesByDate(
          request.startDate(), request.endDate(), request.categoryScope());
    }

    NavigableMap<LocalDate, Map<String, BigDecimal>> bufferedPrices =
        new TreeMap<>(
            marketDataRepository.fetchEtfPricesByDate(
                request.startDate().minusDays(MOMENTUM_LOOKBACK_BUFFER_DAYS), request.endDate()));
    Map<LocalDate, Map<String, BigDecimal>> momentumScores =
        momentumScoreComputer.computeMomentumScores(
            scoreDates, bufferedPrices, MOMENTUM_LOOKBACK_TRADING_DAYS, MOMENTUM_SKIP_TRADING_DAYS);

    Set<String> scopedCategoryIds =
        marketDataRepository.fetchScopedCategoryIds(request.categoryScope());
    momentumScores.values().forEach(scores -> scores.keySet().retainAll(scopedCategoryIds));
    momentumScores.values().removeIf(Map::isEmpty);
    return momentumScores;
  }

  /**
   * Dual-momentum overlay: on each rebalance date the market must be risk-on (SPY at/above its
   * trailing MA) to stay invested; risk-off dates are moved to cash (empty allocation). Uses a
   * buffered price history so the MA is available from the first rebalance.
   */
  private Map<LocalDate, List<String>> applyTrendFilter(
      Map<LocalDate, List<String>> allocationsByRebalanceDate,
      LocalDate startDate,
      LocalDate endDate) {
    NavigableMap<LocalDate, BigDecimal> regimePrices =
        new TreeMap<>(
            marketDataRepository.fetchSpyPricesByDate(
                startDate.minusDays(TREND_FILTER_LOOKBACK_BUFFER_DAYS), endDate));
    Map<LocalDate, List<String>> filtered = new LinkedHashMap<>();
    allocationsByRebalanceDate.forEach(
        (date, allocation) ->
            filtered.put(
                date,
                marketRegimeFilter.isRiskOn(date, regimePrices, TREND_FILTER_MA_DAYS)
                    ? allocation
                    : List.of()));
    return filtered;
  }

  private List<LocalDate> computeRebalanceDates(
      List<LocalDate> tradingDates, String rebalanceFrequency) {
    if (tradingDates.isEmpty()) return List.of();
    List<LocalDate> rebalanceDates = new ArrayList<>();
    rebalanceDates.add(tradingDates.get(0));

    LocalDate lastRebalance = tradingDates.get(0);
    for (LocalDate date : tradingDates) {
      if (isDue(rebalanceFrequency, lastRebalance, date) && !date.equals(lastRebalance)) {
        rebalanceDates.add(date);
        lastRebalance = date;
      }
    }
    return rebalanceDates;
  }

  private boolean isDue(String rebalanceFrequency, LocalDate lastRebalance, LocalDate date) {
    return switch (rebalanceFrequency.toUpperCase()) {
      case "WEEKLY" -> ChronoUnit.WEEKS.between(lastRebalance, date) >= 1;
      case "QUARTERLY" -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 3;
      default -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 1;
    };
  }
}

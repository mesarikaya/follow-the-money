package com.ftm.app.backtest.service;

import static com.ftm.app.jooq.Tables.*;

import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import com.ftm.app.api.dto.BacktestResult.RebalanceEvent;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NavigableMap;
import java.util.Set;
import java.util.TreeMap;
import org.jooq.Condition;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class BacktestEngine {

  private static final Logger log = LoggerFactory.getLogger(BacktestEngine.class);
  private static final double INITIAL_PORTFOLIO_VALUE = 10_000.0;
  private static final double TRADING_DAYS_PER_YEAR = 252.0;

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

  private final SignalRepository signalRepository;
  private final DSLContext dsl;
  private final AllocationComputer allocationComputer;
  private final TurnoverCostCalculator turnoverCostCalculator;
  private final MarketRegimeFilter marketRegimeFilter;
  private final MomentumScoreComputer momentumScoreComputer;

  public BacktestEngine(
      SignalRepository signalRepository,
      DSLContext dsl,
      AllocationComputer allocationComputer,
      TurnoverCostCalculator turnoverCostCalculator,
      MarketRegimeFilter marketRegimeFilter,
      MomentumScoreComputer momentumScoreComputer) {
    this.signalRepository = signalRepository;
    this.dsl = dsl;
    this.allocationComputer = allocationComputer;
    this.turnoverCostCalculator = turnoverCostCalculator;
    this.marketRegimeFilter = marketRegimeFilter;
    this.momentumScoreComputer = momentumScoreComputer;
  }

  public BacktestResult run(BacktestRequest request) {
    log.info(
        "Running backtest: {} to {}, rebalance={}, topN={}",
        request.startDate(),
        request.endDate(),
        request.rebalanceFrequency(),
        request.topN());

    List<LocalDate> tradingDates = fetchTradingDates(request.startDate(), request.endDate());
    if (tradingDates.isEmpty()) {
      throw new IllegalArgumentException("No price data found for the requested date range.");
    }

    List<LocalDate> rebalanceDates =
        computeRebalanceDates(tradingDates, request.rebalanceFrequency());

    // Selection scores: the theory-model COMPOSITE (default) or classic 12-1 MOMENTUM, over the
    // same category scope so the two signal sources are compared on an identical universe.
    Map<LocalDate, Map<String, BigDecimal>> signalScoresByDate =
        resolveSignalScores(request, rebalanceDates);
    Map<LocalDate, Map<String, BigDecimal>> pricesByDate =
        fetchEtfPricesByDate(request.startDate(), request.endDate());
    Map<LocalDate, BigDecimal> spyPricesByDate =
        fetchSpyPricesByDate(request.startDate(), request.endDate());

    if (signalScoresByDate.isEmpty()) {
      throw new IllegalArgumentException(
          "No selection scores found for the date range. Run signal computation first (or widen the"
              + " range so 12-1 momentum has enough leading price history).");
    }

    // Only allocate to categories that have at least one price in the range — sub-sector ETFs
    // (KBE, XBI, etc.) may not have been ingested, causing the portfolio to flatline if selected.
    Set<String> categoriesWithPriceData = new HashSet<>();
    pricesByDate.values().forEach(m -> categoriesWithPriceData.addAll(m.keySet()));

    Map<LocalDate, List<String>> allocationsByRebalanceDate =
        allocationComputer.computeAllocations(
            rebalanceDates,
            signalScoresByDate,
            request.topN(),
            request.signalThreshold(),
            categoriesWithPriceData,
            request.invertSignal());

    if (request.trendFilter()) {
      allocationsByRebalanceDate =
          applyTrendFilter(allocationsByRebalanceDate, request.startDate(), request.endDate());
    }

    List<EquityCurvePoint> equityCurve =
        simulatePortfolio(
            tradingDates,
            allocationsByRebalanceDate,
            pricesByDate,
            spyPricesByDate,
            request.transactionCostBps());

    // Equal-weight benchmark: hold every in-scope category with price data, equal-weighted, on the
    // same rebalance schedule (no trading cost). It answers "does the signal beat naive
    // diversification?" — selecting a large N here yields the full investable set.
    Map<LocalDate, List<String>> equalWeightAllocations =
        allocationComputer.computeAllocations(
            rebalanceDates, signalScoresByDate, Integer.MAX_VALUE, null, categoriesWithPriceData);
    List<EquityCurvePoint> equalWeightCurve =
        simulatePortfolio(tradingDates, equalWeightAllocations, pricesByDate, spyPricesByDate, 0);

    Map<LocalDate, Double> portfolioValueByDate = new HashMap<>();
    for (EquityCurvePoint p : equityCurve) portfolioValueByDate.put(p.date(), p.portfolioValue());

    List<RebalanceEvent> rebalanceHistory =
        allocationsByRebalanceDate.entrySet().stream()
            .filter(e -> !e.getValue().isEmpty())
            .map(
                e ->
                    new RebalanceEvent(
                        e.getKey(),
                        e.getValue(),
                        portfolioValueByDate.getOrDefault(e.getKey(), INITIAL_PORTFOLIO_VALUE)))
            .sorted(Comparator.comparing(RebalanceEvent::date))
            .toList();

    return computeStatistics(
        request, equityCurve, equalWeightCurve, rebalanceHistory, tradingDates.size());
  }

  private List<LocalDate> fetchTradingDates(LocalDate startDate, LocalDate endDate) {
    return dsl.selectDistinct(BENCHMARK_PRICES.TRADE_DATE)
        .from(BENCHMARK_PRICES)
        .where(BENCHMARK_PRICES.TRADE_DATE.between(startDate, endDate))
        .and(BENCHMARK_PRICES.TICKER.eq("SPY"))
        .orderBy(BENCHMARK_PRICES.TRADE_DATE.asc())
        .fetchInto(LocalDate.class);
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
      return fetchCompositesByDate(request.startDate(), request.endDate(), request.categoryScope());
    }

    NavigableMap<LocalDate, Map<String, BigDecimal>> bufferedPrices =
        new TreeMap<>(
            fetchEtfPricesByDate(
                request.startDate().minusDays(MOMENTUM_LOOKBACK_BUFFER_DAYS), request.endDate()));
    Map<LocalDate, Map<String, BigDecimal>> momentumScores =
        momentumScoreComputer.computeMomentumScores(
            scoreDates, bufferedPrices, MOMENTUM_LOOKBACK_TRADING_DAYS, MOMENTUM_SKIP_TRADING_DAYS);

    Set<String> scopedCategoryIds = fetchScopedCategoryIds(request.categoryScope());
    momentumScores.values().forEach(scores -> scores.keySet().retainAll(scopedCategoryIds));
    momentumScores.values().removeIf(Map::isEmpty);
    return momentumScores;
  }

  private Set<String> fetchScopedCategoryIds(String categoryScope) {
    return new HashSet<>(
        dsl.select(CATEGORIES.ID)
            .from(CATEGORIES)
            .where(categoryScopeCondition(categoryScope))
            .fetchInto(String.class));
  }

  private Condition categoryScopeCondition(String categoryScope) {
    return switch (categoryScope.toUpperCase()) {
      case "EQUITY_SECTORS_ONLY" ->
          CATEGORIES.TYPE.eq("EQUITY_SECTOR").and(CATEGORIES.PARENT_ID.isNull());
      case "TOP_LEVEL_ONLY" -> CATEGORIES.PARENT_ID.isNull();
      default -> DSL.noCondition();
    };
  }

  private Map<LocalDate, Map<String, BigDecimal>> fetchCompositesByDate(
      LocalDate startDate, LocalDate endDate, String categoryScope) {
    Map<LocalDate, Map<String, BigDecimal>> result = new TreeMap<>();

    Condition scopeCondition = categoryScopeCondition(categoryScope);

    dsl.select(SIGNALS.SIGNAL_DATE, SIGNALS.CATEGORY_ID, SIGNALS.VALUE)
        .from(SIGNALS)
        .join(CATEGORIES)
        .on(CATEGORIES.ID.eq(SIGNALS.CATEGORY_ID))
        .where(SIGNALS.SIGNAL_TYPE.eq(SignalType.COMPOSITE.name()))
        .and(SIGNALS.SIGNAL_DATE.between(startDate, endDate))
        .and(scopeCondition)
        .fetch()
        .forEach(
            r ->
                result
                    .computeIfAbsent(r.get(SIGNALS.SIGNAL_DATE), d -> new HashMap<>())
                    .put(r.get(SIGNALS.CATEGORY_ID), r.get(SIGNALS.VALUE)));
    return result;
  }

  private Map<LocalDate, Map<String, BigDecimal>> fetchEtfPricesByDate(
      LocalDate startDate, LocalDate endDate) {
    Map<LocalDate, Map<String, BigDecimal>> result = new TreeMap<>();
    dsl.select(RAW_PRICES.TRADE_DATE, RAW_PRICES.CATEGORY_ID, RAW_PRICES.ADJ_CLOSE)
        .from(RAW_PRICES)
        .where(RAW_PRICES.TRADE_DATE.between(startDate, endDate))
        .orderBy(RAW_PRICES.TRADE_DATE.asc())
        .fetch()
        .forEach(
            r -> {
              BigDecimal adjClose = r.get(RAW_PRICES.ADJ_CLOSE);
              if (adjClose != null) {
                result
                    .computeIfAbsent(r.get(RAW_PRICES.TRADE_DATE), d -> new HashMap<>())
                    .put(r.get(RAW_PRICES.CATEGORY_ID), adjClose);
              }
            });
    return result;
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
            fetchSpyPricesByDate(startDate.minusDays(TREND_FILTER_LOOKBACK_BUFFER_DAYS), endDate));
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

  private Map<LocalDate, BigDecimal> fetchSpyPricesByDate(LocalDate startDate, LocalDate endDate) {
    Map<LocalDate, BigDecimal> result = new TreeMap<>();
    dsl.select(BENCHMARK_PRICES.TRADE_DATE, BENCHMARK_PRICES.ADJ_CLOSE)
        .from(BENCHMARK_PRICES)
        .where(BENCHMARK_PRICES.TICKER.eq("SPY"))
        .and(BENCHMARK_PRICES.TRADE_DATE.between(startDate, endDate))
        .orderBy(BENCHMARK_PRICES.TRADE_DATE.asc())
        .fetch()
        .forEach(
            r -> {
              BigDecimal adjClose = r.get(BENCHMARK_PRICES.ADJ_CLOSE);
              if (adjClose != null) {
                result.put(r.get(BENCHMARK_PRICES.TRADE_DATE), adjClose);
              }
            });
    return result;
  }

  private List<LocalDate> computeRebalanceDates(
      List<LocalDate> tradingDates, String rebalanceFrequency) {
    if (tradingDates.isEmpty()) return List.of();
    List<LocalDate> rebalanceDates = new ArrayList<>();
    rebalanceDates.add(tradingDates.get(0));

    LocalDate lastRebalance = tradingDates.get(0);
    for (LocalDate date : tradingDates) {
      boolean shouldRebalance =
          switch (rebalanceFrequency.toUpperCase()) {
            case "WEEKLY" -> ChronoUnit.WEEKS.between(lastRebalance, date) >= 1;
            case "MONTHLY" -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 1;
            case "QUARTERLY" -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 3;
            default -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 1;
          };
      if (shouldRebalance && !date.equals(lastRebalance)) {
        rebalanceDates.add(date);
        lastRebalance = date;
      }
    }
    return rebalanceDates;
  }

  List<EquityCurvePoint> simulatePortfolio(
      List<LocalDate> tradingDates,
      Map<LocalDate, List<String>> allocationsByRebalanceDate,
      Map<LocalDate, Map<String, BigDecimal>> pricesByDate,
      Map<LocalDate, BigDecimal> spyPricesByDate) {
    return simulatePortfolio(
        tradingDates, allocationsByRebalanceDate, pricesByDate, spyPricesByDate, null);
  }

  List<EquityCurvePoint> simulatePortfolio(
      List<LocalDate> tradingDates,
      Map<LocalDate, List<String>> allocationsByRebalanceDate,
      Map<LocalDate, Map<String, BigDecimal>> pricesByDate,
      Map<LocalDate, BigDecimal> spyPricesByDate,
      Integer transactionCostBps) {

    int costBps = transactionCostBps == null ? 0 : transactionCostBps;
    List<EquityCurvePoint> equityCurve = new ArrayList<>();
    if (tradingDates.isEmpty()) return equityCurve;

    double portfolioValue = INITIAL_PORTFOLIO_VALUE;
    double portfolioValueAtPeriodStart = INITIAL_PORTFOLIO_VALUE;
    double spyValue = INITIAL_PORTFOLIO_VALUE;

    List<String> currentAllocation = List.of();
    Map<String, Double> entryPrices = new HashMap<>();
    double spyEntryPrice = 0.0;

    // Get SPY entry price
    BigDecimal firstSpyPrice = spyPricesByDate.get(tradingDates.get(0));
    if (firstSpyPrice != null) {
      spyEntryPrice = firstSpyPrice.doubleValue();
    }

    List<LocalDate> sortedRebalanceDates = new ArrayList<>(allocationsByRebalanceDate.keySet());
    Collections.sort(sortedRebalanceDates);

    for (LocalDate tradingDate : tradingDates) {
      // Check if this is a rebalance date
      List<String> newAllocation = allocationsByRebalanceDate.get(tradingDate);
      if (newAllocation != null && !newAllocation.equals(currentAllocation)) {
        // Record entry prices for new allocation
        Map<String, BigDecimal> prices = pricesByDate.get(tradingDate);
        if (prices != null) {
          // Charge trading cost on the turnover before the new period starts compounding.
          double costFraction =
              turnoverCostCalculator.costFraction(currentAllocation, newAllocation, costBps);
          portfolioValue *= (1.0 - costFraction);
          portfolioValueAtPeriodStart = portfolioValue;
          entryPrices.clear();
          for (String categoryId : newAllocation) {
            BigDecimal price = prices.get(categoryId);
            if (price != null && price.signum() > 0) {
              entryPrices.put(categoryId, price.doubleValue());
            }
          }
          currentAllocation = newAllocation.stream().filter(entryPrices::containsKey).toList();
        }
      }

      // Compute portfolio return for this day
      if (!currentAllocation.isEmpty()) {
        Map<String, BigDecimal> currentPrices = pricesByDate.get(tradingDate);
        if (currentPrices != null) {
          double totalWeight = currentAllocation.size();
          double portfolioDayReturn = 0.0;
          int validPositions = 0;
          for (String categoryId : currentAllocation) {
            BigDecimal currentPrice = currentPrices.get(categoryId);
            Double entryPrice = entryPrices.get(categoryId);
            if (currentPrice != null
                && currentPrice.signum() > 0
                && entryPrice != null
                && entryPrice > 0) {
              portfolioDayReturn += (currentPrice.doubleValue() / entryPrice) / totalWeight;
              validPositions++;
            }
          }
          if (validPositions > 0) {
            portfolioValue =
                portfolioValueAtPeriodStart * portfolioDayReturn * (totalWeight / validPositions);
          }
        }
      }

      // Compute SPY value for this day
      BigDecimal currentSpyPrice = spyPricesByDate.get(tradingDate);
      if (currentSpyPrice != null && spyEntryPrice > 0) {
        spyValue = INITIAL_PORTFOLIO_VALUE * (currentSpyPrice.doubleValue() / spyEntryPrice);
      }

      equityCurve.add(new EquityCurvePoint(tradingDate, portfolioValue, spyValue));
    }

    return equityCurve;
  }

  BacktestResult computeStatistics(
      BacktestRequest request,
      List<EquityCurvePoint> equityCurve,
      List<EquityCurvePoint> equalWeightCurve,
      List<RebalanceEvent> rebalanceHistory,
      int tradingDays) {
    if (equityCurve.isEmpty()) {
      throw new IllegalArgumentException("Could not simulate portfolio — no price data available.");
    }

    double firstPortfolio = equityCurve.get(0).portfolioValue();
    double lastPortfolio = equityCurve.get(equityCurve.size() - 1).portfolioValue();
    double firstSpy = equityCurve.get(0).spyValue();
    double lastSpy = equityCurve.get(equityCurve.size() - 1).spyValue();

    double totalReturnPct = (lastPortfolio - firstPortfolio) / firstPortfolio * 100.0;
    double spyTotalReturnPct = (lastSpy - firstSpy) / firstSpy * 100.0;

    double yearsElapsed = tradingDays / TRADING_DAYS_PER_YEAR;
    double annualizedReturnPct =
        (Math.pow(lastPortfolio / firstPortfolio, 1.0 / yearsElapsed) - 1.0) * 100.0;

    double maxDrawdownPct = computeMaxDrawdown(equityCurve, false);
    double spyMaxDrawdownPct = computeMaxDrawdown(equityCurve, true);
    double spyAnnualizedReturnPct =
        (Math.pow(lastSpy / firstSpy, 1.0 / yearsElapsed) - 1.0) * 100.0;
    double sharpeRatio = computeSharpeRatio(equityCurve, false);
    double spySharpeRatio = computeSharpeRatio(equityCurve, true);
    double sortinoRatio = computeSortinoRatio(equityCurve, false);
    double calmarRatio = computeCalmarRatio(annualizedReturnPct, maxDrawdownPct);
    double spySortinoRatio = computeSortinoRatio(equityCurve, true);
    double spyCalmarRatio = computeCalmarRatio(spyAnnualizedReturnPct, spyMaxDrawdownPct);

    // Equal-weight benchmark metrics (portfolioValue column of the equal-weight simulation).
    BigDecimal equalWeightTotalReturnPct = null;
    BigDecimal equalWeightAnnualizedReturnPct = null;
    BigDecimal equalWeightMaxDrawdownPct = null;
    BigDecimal equalWeightSharpeRatio = null;
    if (equalWeightCurve != null && !equalWeightCurve.isEmpty()) {
      double eqwFirst = equalWeightCurve.get(0).portfolioValue();
      double eqwLast = equalWeightCurve.get(equalWeightCurve.size() - 1).portfolioValue();
      if (eqwFirst > 0) {
        equalWeightTotalReturnPct = roundToFour((eqwLast - eqwFirst) / eqwFirst * 100.0);
        equalWeightAnnualizedReturnPct =
            roundToFour((Math.pow(eqwLast / eqwFirst, 1.0 / yearsElapsed) - 1.0) * 100.0);
      }
      equalWeightMaxDrawdownPct = roundToFour(computeMaxDrawdown(equalWeightCurve, false));
      equalWeightSharpeRatio = roundToFour(computeSharpeRatio(equalWeightCurve, false));
    }

    return new BacktestResult(
        null, // run_id set by repository after insert
        null, // run_at set by repository
        request.startDate(),
        request.endDate(),
        request.rebalanceFrequency(),
        request.topN(),
        request.signalThreshold(),
        request.signalSource(),
        request.categoryScope(),
        request.invertSignal(),
        request.trendFilter(),
        request.transactionCostBps(),
        roundToFour(totalReturnPct),
        roundToFour(annualizedReturnPct),
        roundToFour(maxDrawdownPct),
        roundToFour(sharpeRatio),
        roundToFour(sortinoRatio),
        roundToFour(calmarRatio),
        roundToFour(spyTotalReturnPct),
        roundToFour(spyAnnualizedReturnPct),
        roundToFour(spyMaxDrawdownPct),
        roundToFour(spySharpeRatio),
        roundToFour(spySortinoRatio),
        roundToFour(spyCalmarRatio),
        equalWeightTotalReturnPct,
        equalWeightAnnualizedReturnPct,
        equalWeightMaxDrawdownPct,
        equalWeightSharpeRatio,
        tradingDays,
        equityCurve,
        rebalanceHistory);
  }

  double computeSortinoRatio(List<EquityCurvePoint> curve, boolean useSpy) {
    if (curve.size() < 2) return 0.0;
    List<Double> dailyReturns = new ArrayList<>();
    for (int i = 1; i < curve.size(); i++) {
      double previous = useSpy ? curve.get(i - 1).spyValue() : curve.get(i - 1).portfolioValue();
      double current = useSpy ? curve.get(i).spyValue() : curve.get(i).portfolioValue();
      if (previous > 0) dailyReturns.add((current - previous) / previous);
    }
    if (dailyReturns.isEmpty()) return 0.0;
    double meanReturn =
        dailyReturns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    // Downside variance: sum(min(r,0)^2) / n  — matches frontend formula
    double downsideVariance =
        dailyReturns.stream().mapToDouble(r -> Math.pow(Math.min(r, 0.0), 2)).average().orElse(0.0);
    double downsideDeviation = Math.sqrt(downsideVariance);
    if (downsideDeviation == 0.0) return 0.0;
    return (meanReturn / downsideDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  double computeCalmarRatio(double annualizedReturnPct, double maxDrawdownPct) {
    if (maxDrawdownPct == 0.0) return 0.0;
    return annualizedReturnPct / maxDrawdownPct;
  }

  private double computeMaxDrawdown(List<EquityCurvePoint> curve, boolean useSpy) {
    double peakValue = INITIAL_PORTFOLIO_VALUE;
    double maxDrawdown = 0.0;
    for (EquityCurvePoint point : curve) {
      double value = useSpy ? point.spyValue() : point.portfolioValue();
      if (value > peakValue) peakValue = value;
      double drawdown = (peakValue - value) / peakValue * 100.0;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    return maxDrawdown;
  }

  private double computeSharpeRatio(List<EquityCurvePoint> curve, boolean useSpy) {
    if (curve.size() < 2) return 0.0;

    List<Double> dailyReturns = new ArrayList<>();
    for (int i = 1; i < curve.size(); i++) {
      double previous = useSpy ? curve.get(i - 1).spyValue() : curve.get(i - 1).portfolioValue();
      double current = useSpy ? curve.get(i).spyValue() : curve.get(i).portfolioValue();
      if (previous > 0) {
        dailyReturns.add((current - previous) / previous);
      }
    }

    if (dailyReturns.isEmpty()) return 0.0;

    double meanReturn =
        dailyReturns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
    double variance =
        dailyReturns.stream()
            .mapToDouble(r -> (r - meanReturn) * (r - meanReturn))
            .average()
            .orElse(0.0);
    double stdDev = Math.sqrt(variance);
    if (stdDev == 0.0) return 0.0;

    // Risk-free daily rate ≈ 0 (simplified; FRED FEDFUNDS could be used but adds complexity)
    return (meanReturn / stdDev) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  private BigDecimal roundToFour(double value) {
    if (Double.isNaN(value) || Double.isInfinite(value)) return BigDecimal.ZERO;
    return BigDecimal.valueOf(value)
        .round(new MathContext(8, RoundingMode.HALF_UP))
        .setScale(4, RoundingMode.HALF_UP);
  }
}

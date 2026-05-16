package com.ftm.app.backtest.service;

import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import com.ftm.app.domain.SignalType;
import com.ftm.app.signals.repository.SignalRepository;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class BacktestEngine {

    private static final Logger log = LoggerFactory.getLogger(BacktestEngine.class);
    private static final double INITIAL_PORTFOLIO_VALUE = 10_000.0;
    private static final double TRADING_DAYS_PER_YEAR   = 252.0;

    private final SignalRepository signalRepository;
    private final DSLContext dsl;

    public BacktestEngine(SignalRepository signalRepository, DSLContext dsl) {
        this.signalRepository = signalRepository;
        this.dsl = dsl;
    }

    public BacktestResult run(BacktestRequest request) {
        log.info("Running backtest: {} to {}, rebalance={}, topN={}",
                request.startDate(), request.endDate(), request.rebalanceFrequency(), request.topN());

        List<LocalDate> tradingDates = fetchTradingDates(request.startDate(), request.endDate());
        if (tradingDates.isEmpty()) {
            throw new IllegalArgumentException("No price data found for the requested date range.");
        }

        Map<LocalDate, Map<String, BigDecimal>> compositesByDate = fetchCompositesByDate(request.startDate(), request.endDate());
        Map<LocalDate, Map<String, BigDecimal>> pricesByDate = fetchEtfPricesByDate(request.startDate(), request.endDate());
        Map<LocalDate, BigDecimal> spyPricesByDate = fetchSpyPricesByDate(request.startDate(), request.endDate());

        if (compositesByDate.isEmpty()) {
            throw new IllegalArgumentException(
                    "No composite scores found for the date range. Run signal computation first.");
        }

        List<LocalDate> rebalanceDates = computeRebalanceDates(tradingDates, request.rebalanceFrequency());
        Map<LocalDate, List<String>> allocationsByRebalanceDate = computeAllocations(
                rebalanceDates, compositesByDate, request.topN(), request.signalThreshold());

        List<EquityCurvePoint> equityCurve = simulatePortfolio(
                tradingDates, allocationsByRebalanceDate, pricesByDate, spyPricesByDate);

        return computeStatistics(request, equityCurve, tradingDates.size());
    }

    private List<LocalDate> fetchTradingDates(LocalDate startDate, LocalDate endDate) {
        return dsl.selectDistinct(DSL.field("trade_date", LocalDate.class))
                .from(DSL.table("benchmark_prices"))
                .where(DSL.field("trade_date").between(startDate, endDate))
                .and(DSL.field("ticker").eq("SPY"))
                .orderBy(DSL.field("trade_date").asc())
                .fetch(r -> r.get("trade_date", LocalDate.class));
    }

    private Map<LocalDate, Map<String, BigDecimal>> fetchCompositesByDate(LocalDate startDate, LocalDate endDate) {
        Map<LocalDate, Map<String, BigDecimal>> result = new TreeMap<>();
        dsl.select(
                        DSL.field("signal_date", LocalDate.class),
                        DSL.field("category_id", String.class),
                        DSL.field("value", BigDecimal.class))
                .from(DSL.table("signals"))
                .where(DSL.field("signal_type").eq(SignalType.COMPOSITE.name()))
                .and(DSL.field("signal_date").between(startDate, endDate))
                .fetch()
                .forEach(r -> {
                    LocalDate date = r.get("signal_date", LocalDate.class);
                    String categoryId = r.get("category_id", String.class);
                    BigDecimal value = r.get("value", BigDecimal.class);
                    result.computeIfAbsent(date, d -> new HashMap<>()).put(categoryId, value);
                });
        return result;
    }

    private Map<LocalDate, Map<String, BigDecimal>> fetchEtfPricesByDate(LocalDate startDate, LocalDate endDate) {
        Map<LocalDate, Map<String, BigDecimal>> result = new TreeMap<>();
        dsl.select(
                        DSL.field("trade_date", LocalDate.class),
                        DSL.field("category_id", String.class),
                        DSL.field("adj_close", BigDecimal.class))
                .from(DSL.table("raw_prices"))
                .where(DSL.field("trade_date").between(startDate, endDate))
                .orderBy(DSL.field("trade_date").asc())
                .fetch()
                .forEach(r -> {
                    LocalDate date = r.get("trade_date", LocalDate.class);
                    String categoryId = r.get("category_id", String.class);
                    BigDecimal adjClose = r.get("adj_close", BigDecimal.class);
                    if (adjClose != null) {
                        result.computeIfAbsent(date, d -> new HashMap<>()).put(categoryId, adjClose);
                    }
                });
        return result;
    }

    private Map<LocalDate, BigDecimal> fetchSpyPricesByDate(LocalDate startDate, LocalDate endDate) {
        Map<LocalDate, BigDecimal> result = new TreeMap<>();
        dsl.select(
                        DSL.field("trade_date", LocalDate.class),
                        DSL.field("adj_close", BigDecimal.class))
                .from(DSL.table("benchmark_prices"))
                .where(DSL.field("ticker").eq("SPY"))
                .and(DSL.field("trade_date").between(startDate, endDate))
                .orderBy(DSL.field("trade_date").asc())
                .fetch()
                .forEach(r -> {
                    LocalDate date = r.get("trade_date", LocalDate.class);
                    BigDecimal adjClose = r.get("adj_close", BigDecimal.class);
                    if (adjClose != null) {
                        result.put(date, adjClose);
                    }
                });
        return result;
    }

    private List<LocalDate> computeRebalanceDates(List<LocalDate> tradingDates, String rebalanceFrequency) {
        if (tradingDates.isEmpty()) return List.of();
        List<LocalDate> rebalanceDates = new ArrayList<>();
        rebalanceDates.add(tradingDates.get(0));

        LocalDate lastRebalance = tradingDates.get(0);
        for (LocalDate date : tradingDates) {
            boolean shouldRebalance = switch (rebalanceFrequency.toUpperCase()) {
                case "WEEKLY"  -> ChronoUnit.WEEKS.between(lastRebalance, date) >= 1;
                case "MONTHLY" -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 1;
                default -> ChronoUnit.MONTHS.between(lastRebalance, date) >= 1;
            };
            if (shouldRebalance && !date.equals(lastRebalance)) {
                rebalanceDates.add(date);
                lastRebalance = date;
            }
        }
        return rebalanceDates;
    }

    private Map<LocalDate, List<String>> computeAllocations(
            List<LocalDate> rebalanceDates,
            Map<LocalDate, Map<String, BigDecimal>> compositesByDate,
            int topN,
            BigDecimal signalThreshold) {

        Map<LocalDate, List<String>> allocations = new LinkedHashMap<>();
        List<String> lastAllocation = List.of();

        for (LocalDate rebalanceDate : rebalanceDates) {
            Map<String, BigDecimal> composites = findClosestComposites(rebalanceDate, compositesByDate);
            if (composites.isEmpty()) {
                allocations.put(rebalanceDate, lastAllocation);
                continue;
            }

            List<String> topCategories = composites.entrySet().stream()
                    .filter(e -> e.getValue() != null)
                    .filter(e -> signalThreshold == null || e.getValue().compareTo(signalThreshold) >= 0)
                    .sorted(Map.Entry.<String, BigDecimal>comparingByValue().reversed())
                    .limit(topN)
                    .map(Map.Entry::getKey)
                    .toList();

            if (!topCategories.isEmpty()) {
                lastAllocation = topCategories;
            }
            allocations.put(rebalanceDate, lastAllocation);
        }
        return allocations;
    }

    private Map<String, BigDecimal> findClosestComposites(LocalDate targetDate, Map<LocalDate, Map<String, BigDecimal>> compositesByDate) {
        // Find the most recent composite date on or before targetDate
        return compositesByDate.entrySet().stream()
                .filter(e -> !e.getKey().isAfter(targetDate))
                .max(Map.Entry.comparingByKey())
                .map(Map.Entry::getValue)
                .orElse(Map.of());
    }

    private List<EquityCurvePoint> simulatePortfolio(
            List<LocalDate> tradingDates,
            Map<LocalDate, List<String>> allocationsByRebalanceDate,
            Map<LocalDate, Map<String, BigDecimal>> pricesByDate,
            Map<LocalDate, BigDecimal> spyPricesByDate) {

        List<EquityCurvePoint> equityCurve = new ArrayList<>();
        if (tradingDates.isEmpty()) return equityCurve;

        double portfolioValue = INITIAL_PORTFOLIO_VALUE;
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
                    entryPrices.clear();
                    for (String categoryId : newAllocation) {
                        BigDecimal price = prices.get(categoryId);
                        if (price != null) {
                            entryPrices.put(categoryId, price.doubleValue());
                        }
                    }
                    currentAllocation = newAllocation.stream()
                            .filter(entryPrices::containsKey)
                            .toList();
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
                        if (currentPrice != null && entryPrice != null && entryPrice > 0) {
                            portfolioDayReturn += (currentPrice.doubleValue() / entryPrice) / totalWeight;
                            validPositions++;
                        }
                    }
                    if (validPositions > 0) {
                        portfolioValue = INITIAL_PORTFOLIO_VALUE * portfolioDayReturn * (totalWeight / validPositions);
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

    private BacktestResult computeStatistics(BacktestRequest request, List<EquityCurvePoint> equityCurve, int tradingDays) {
        if (equityCurve.isEmpty()) {
            throw new IllegalArgumentException("Could not simulate portfolio — no price data available.");
        }

        double firstPortfolio = equityCurve.get(0).portfolioValue();
        double lastPortfolio  = equityCurve.get(equityCurve.size() - 1).portfolioValue();
        double firstSpy       = equityCurve.get(0).spyValue();
        double lastSpy        = equityCurve.get(equityCurve.size() - 1).spyValue();

        double totalReturnPct    = (lastPortfolio - firstPortfolio) / firstPortfolio * 100.0;
        double spyTotalReturnPct = (lastSpy - firstSpy) / firstSpy * 100.0;

        double yearsElapsed = tradingDays / TRADING_DAYS_PER_YEAR;
        double annualizedReturnPct = (Math.pow(lastPortfolio / firstPortfolio, 1.0 / yearsElapsed) - 1.0) * 100.0;

        double maxDrawdownPct = computeMaxDrawdown(equityCurve);
        double sharpeRatio    = computeSharpeRatio(equityCurve, false);
        double spySharpeRatio = computeSharpeRatio(equityCurve, true);

        return new BacktestResult(
                null, // run_id set by repository after insert
                null, // run_at set by repository
                request.startDate(),
                request.endDate(),
                request.rebalanceFrequency(),
                request.topN(),
                request.signalThreshold(),
                roundToFour(totalReturnPct),
                roundToFour(annualizedReturnPct),
                roundToFour(maxDrawdownPct),
                roundToFour(sharpeRatio),
                roundToFour(spyTotalReturnPct),
                roundToFour(spySharpeRatio),
                tradingDays,
                equityCurve);
    }

    private double computeMaxDrawdown(List<EquityCurvePoint> curve) {
        double peakValue = INITIAL_PORTFOLIO_VALUE;
        double maxDrawdown = 0.0;
        for (EquityCurvePoint point : curve) {
            if (point.portfolioValue() > peakValue) {
                peakValue = point.portfolioValue();
            }
            double drawdown = (peakValue - point.portfolioValue()) / peakValue * 100.0;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        return maxDrawdown;
    }

    private double computeSharpeRatio(List<EquityCurvePoint> curve, boolean useSpy) {
        if (curve.size() < 2) return 0.0;

        List<Double> dailyReturns = new ArrayList<>();
        for (int i = 1; i < curve.size(); i++) {
            double previous = useSpy ? curve.get(i - 1).spyValue() : curve.get(i - 1).portfolioValue();
            double current  = useSpy ? curve.get(i).spyValue()     : curve.get(i).portfolioValue();
            if (previous > 0) {
                dailyReturns.add((current - previous) / previous);
            }
        }

        if (dailyReturns.isEmpty()) return 0.0;

        double meanReturn = dailyReturns.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        double variance = dailyReturns.stream()
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
        return BigDecimal.valueOf(value).round(new MathContext(8, RoundingMode.HALF_UP)).setScale(4, RoundingMode.HALF_UP);
    }
}

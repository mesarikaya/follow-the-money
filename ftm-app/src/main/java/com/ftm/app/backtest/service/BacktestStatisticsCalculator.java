package com.ftm.app.backtest.service;

import static com.ftm.app.backtest.service.PortfolioSimulator.INITIAL_PORTFOLIO_VALUE;

import com.ftm.app.api.dto.BacktestRequest;
import com.ftm.app.api.dto.BacktestResult;
import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import com.ftm.app.api.dto.BacktestResult.RebalanceEvent;
import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.function.ToDoubleFunction;
import org.springframework.stereotype.Component;

/**
 * Turns the simulated equity curves into the numbers a human judges a strategy by: total and
 * annualized return, max drawdown, and the Sharpe / Sortino / Calmar ratios — for the strategy, for
 * the benchmark, and for the equal-weight comparison.
 */
@Component
public class BacktestStatisticsCalculator {

  private static final double TRADING_DAYS_PER_YEAR = 252.0;

  private static final ToDoubleFunction<EquityCurvePoint> PORTFOLIO = EquityCurvePoint::portfolioValue;
  private static final ToDoubleFunction<EquityCurvePoint> BENCHMARK = EquityCurvePoint::spyValue;

  public BacktestResult computeStatistics(
      BacktestRequest request,
      List<EquityCurvePoint> equityCurve,
      List<EquityCurvePoint> equalWeightCurve,
      List<RebalanceEvent> rebalanceHistory,
      int tradingDays) {
    if (equityCurve.isEmpty()) {
      throw new IllegalArgumentException("Could not simulate portfolio — no price data available.");
    }

    double yearsElapsed = tradingDays / TRADING_DAYS_PER_YEAR;

    double totalReturnPct = totalReturnPct(equityCurve, PORTFOLIO);
    double annualizedReturnPct = annualizedReturnPct(equityCurve, PORTFOLIO, yearsElapsed);
    double maxDrawdownPct = computeMaxDrawdown(equityCurve, PORTFOLIO);
    double sharpeRatio = computeSharpeRatio(equityCurve, PORTFOLIO);
    double sortinoRatio = computeSortinoRatio(equityCurve, false);
    double calmarRatio = computeCalmarRatio(annualizedReturnPct, maxDrawdownPct);

    double spyTotalReturnPct = totalReturnPct(equityCurve, BENCHMARK);
    double spyAnnualizedReturnPct = annualizedReturnPct(equityCurve, BENCHMARK, yearsElapsed);
    double spyMaxDrawdownPct = computeMaxDrawdown(equityCurve, BENCHMARK);
    double spySharpeRatio = computeSharpeRatio(equityCurve, BENCHMARK);
    double spySortinoRatio = computeSortinoRatio(equityCurve, true);
    double spyCalmarRatio = computeCalmarRatio(spyAnnualizedReturnPct, spyMaxDrawdownPct);

    EqualWeightMetrics equalWeight = computeEqualWeightMetrics(equalWeightCurve, yearsElapsed);

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
        equalWeight.totalReturnPct(),
        equalWeight.annualizedReturnPct(),
        equalWeight.maxDrawdownPct(),
        equalWeight.sharpeRatio(),
        tradingDays,
        equityCurve,
        rebalanceHistory);
  }

  /** The equal-weight benchmark's own metrics; all null when it was never simulated. */
  private record EqualWeightMetrics(
      BigDecimal totalReturnPct,
      BigDecimal annualizedReturnPct,
      BigDecimal maxDrawdownPct,
      BigDecimal sharpeRatio) {

    static EqualWeightMetrics none() {
      return new EqualWeightMetrics(null, null, null, null);
    }
  }

  private EqualWeightMetrics computeEqualWeightMetrics(
      List<EquityCurvePoint> equalWeightCurve, double yearsElapsed) {
    if (equalWeightCurve == null || equalWeightCurve.isEmpty()) return EqualWeightMetrics.none();

    boolean hasStartingValue = first(equalWeightCurve, PORTFOLIO) > 0;
    return new EqualWeightMetrics(
        hasStartingValue ? roundToFour(totalReturnPct(equalWeightCurve, PORTFOLIO)) : null,
        hasStartingValue
            ? roundToFour(annualizedReturnPct(equalWeightCurve, PORTFOLIO, yearsElapsed))
            : null,
        roundToFour(computeMaxDrawdown(equalWeightCurve, PORTFOLIO)),
        roundToFour(computeSharpeRatio(equalWeightCurve, PORTFOLIO)));
  }

  private static double first(List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of) {
    return of.applyAsDouble(curve.get(0));
  }

  private static double last(List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of) {
    return of.applyAsDouble(curve.get(curve.size() - 1));
  }

  private static double totalReturnPct(
      List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of) {
    double firstValue = first(curve, of);
    return (last(curve, of) - firstValue) / firstValue * 100.0;
  }

  private static double annualizedReturnPct(
      List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of, double yearsElapsed) {
    return (Math.pow(last(curve, of) / first(curve, of), 1.0 / yearsElapsed) - 1.0) * 100.0;
  }

  /** Daily returns of the curve, skipping days whose previous value was not positive. */
  private static List<Double> dailyReturns(
      List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of) {
    List<Double> returns = new ArrayList<>();
    for (int i = 1; i < curve.size(); i++) {
      double previous = of.applyAsDouble(curve.get(i - 1));
      double current = of.applyAsDouble(curve.get(i));
      if (previous > 0) returns.add((current - previous) / previous);
    }
    return returns;
  }

  private static double mean(List<Double> values) {
    return values.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
  }

  /** Return per unit of downside deviation — the Sortino ratio, annualized. */
  double computeSortinoRatio(List<EquityCurvePoint> curve, boolean useSpy) {
    if (curve.size() < 2) return 0.0;
    List<Double> returns = dailyReturns(curve, useSpy ? BENCHMARK : PORTFOLIO);
    if (returns.isEmpty()) return 0.0;

    // Downside variance: sum(min(r,0)^2) / n — matches the frontend formula
    double downsideVariance =
        returns.stream().mapToDouble(r -> Math.pow(Math.min(r, 0.0), 2)).average().orElse(0.0);
    double downsideDeviation = Math.sqrt(downsideVariance);
    if (downsideDeviation == 0.0) return 0.0;
    return (mean(returns) / downsideDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  /** Annualized return per unit of max drawdown — the Calmar ratio. */
  double computeCalmarRatio(double annualizedReturnPct, double maxDrawdownPct) {
    if (maxDrawdownPct == 0.0) return 0.0;
    return annualizedReturnPct / maxDrawdownPct;
  }

  /** Return per unit of volatility, annualized. Risk-free rate is treated as zero. */
  private static double computeSharpeRatio(
      List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of) {
    if (curve.size() < 2) return 0.0;
    List<Double> returns = dailyReturns(curve, of);
    if (returns.isEmpty()) return 0.0;

    double meanReturn = mean(returns);
    double variance =
        returns.stream()
            .mapToDouble(r -> (r - meanReturn) * (r - meanReturn))
            .average()
            .orElse(0.0);
    double standardDeviation = Math.sqrt(variance);
    if (standardDeviation == 0.0) return 0.0;
    return (meanReturn / standardDeviation) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  }

  /** The deepest peak-to-trough fall of the curve, as a positive percentage. */
  private static double computeMaxDrawdown(
      List<EquityCurvePoint> curve, ToDoubleFunction<EquityCurvePoint> of) {
    double peakValue = INITIAL_PORTFOLIO_VALUE;
    double maxDrawdown = 0.0;
    for (EquityCurvePoint point : curve) {
      double value = of.applyAsDouble(point);
      if (value > peakValue) peakValue = value;
      maxDrawdown = Math.max(maxDrawdown, (peakValue - value) / peakValue * 100.0);
    }
    return maxDrawdown;
  }

  private static BigDecimal roundToFour(double value) {
    if (Double.isNaN(value) || Double.isInfinite(value)) return BigDecimal.ZERO;
    return BigDecimal.valueOf(value)
        .round(new MathContext(8, RoundingMode.HALF_UP))
        .setScale(4, RoundingMode.HALF_UP);
  }
}

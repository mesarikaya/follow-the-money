package com.ftm.app.backtest.service;

import com.ftm.app.api.dto.BacktestResult.EquityCurvePoint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Walks the trading calendar day by day and turns a rebalance plan into an equity curve: it holds
 * the current allocation equal-weighted, re-enters at the new prices on each rebalance date (paying
 * the turnover cost first), and tracks a buy-and-hold benchmark alongside for comparison.
 */
@Component
public class PortfolioSimulator {

  public static final double INITIAL_PORTFOLIO_VALUE = 10_000.0;

  private final TurnoverCostCalculator turnoverCostCalculator;

  public PortfolioSimulator(TurnoverCostCalculator turnoverCostCalculator) {
    this.turnoverCostCalculator = turnoverCostCalculator;
  }

  /** Simulates without trading costs. */
  public List<EquityCurvePoint> simulate(
      List<LocalDate> tradingDates,
      Map<LocalDate, List<String>> allocationsByRebalanceDate,
      Map<LocalDate, Map<String, BigDecimal>> pricesByDate,
      Map<LocalDate, BigDecimal> spyPricesByDate) {
    return simulate(tradingDates, allocationsByRebalanceDate, pricesByDate, spyPricesByDate, null);
  }

  public List<EquityCurvePoint> simulate(
      List<LocalDate> tradingDates,
      Map<LocalDate, List<String>> allocationsByRebalanceDate,
      Map<LocalDate, Map<String, BigDecimal>> pricesByDate,
      Map<LocalDate, BigDecimal> spyPricesByDate,
      Integer transactionCostBps) {

    List<EquityCurvePoint> equityCurve = new ArrayList<>();
    if (tradingDates.isEmpty()) return equityCurve;

    int costBps = transactionCostBps == null ? 0 : transactionCostBps;
    PositionBook positions = new PositionBook();
    double spyEntryPrice = entryPriceOf(spyPricesByDate.get(tradingDates.get(0)));
    double spyValue = INITIAL_PORTFOLIO_VALUE;

    for (LocalDate tradingDate : tradingDates) {
      List<String> newAllocation = allocationsByRebalanceDate.get(tradingDate);
      if (positions.shouldRebalanceInto(newAllocation)) {
        positions.rebalance(
            newAllocation, pricesByDate.get(tradingDate), costBps, turnoverCostCalculator);
      }
      positions.markToMarket(pricesByDate.get(tradingDate));

      BigDecimal currentSpyPrice = spyPricesByDate.get(tradingDate);
      if (currentSpyPrice != null && spyEntryPrice > 0) {
        spyValue = INITIAL_PORTFOLIO_VALUE * (currentSpyPrice.doubleValue() / spyEntryPrice);
      }

      equityCurve.add(new EquityCurvePoint(tradingDate, positions.value(), spyValue));
    }

    return equityCurve;
  }

  private static double entryPriceOf(BigDecimal price) {
    return price == null ? 0.0 : price.doubleValue();
  }

  /**
   * The positions currently held, the prices they were entered at, and the portfolio value that
   * compounds off them. Positions with no usable price are dropped rather than zeroing the
   * portfolio.
   */
  private static final class PositionBook {

    private List<String> allocation = List.of();
    private final Map<String, Double> entryPrices = new HashMap<>();
    private double value = INITIAL_PORTFOLIO_VALUE;
    private double valueAtPeriodStart = INITIAL_PORTFOLIO_VALUE;

    boolean shouldRebalanceInto(List<String> newAllocation) {
      return newAllocation != null && !newAllocation.equals(allocation);
    }

    void rebalance(
        List<String> newAllocation,
        Map<String, BigDecimal> prices,
        int costBps,
        TurnoverCostCalculator turnoverCostCalculator) {
      if (prices == null) return;

      double costFraction = turnoverCostCalculator.costFraction(allocation, newAllocation, costBps);
      value *= (1.0 - costFraction);
      valueAtPeriodStart = value;

      entryPrices.clear();
      for (String categoryId : newAllocation) {
        BigDecimal price = prices.get(categoryId);
        if (isUsable(price)) entryPrices.put(categoryId, price.doubleValue());
      }
      allocation = newAllocation.stream().filter(entryPrices::containsKey).toList();
    }

    void markToMarket(Map<String, BigDecimal> currentPrices) {
      if (allocation.isEmpty() || currentPrices == null) return;

      double positionCount = allocation.size();
      double growthFactor = 0.0;
      int pricedPositions = 0;
      for (String categoryId : allocation) {
        BigDecimal currentPrice = currentPrices.get(categoryId);
        Double entryPrice = entryPrices.get(categoryId);
        if (isUsable(currentPrice) && entryPrice != null && entryPrice > 0) {
          growthFactor += (currentPrice.doubleValue() / entryPrice) / positionCount;
          pricedPositions++;
        }
      }
      if (pricedPositions > 0) {
        value = valueAtPeriodStart * growthFactor * (positionCount / pricedPositions);
      }
    }

    double value() {
      return value;
    }

    private static boolean isUsable(BigDecimal price) {
      return price != null && price.signum() > 0;
    }
  }
}

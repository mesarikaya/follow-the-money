package com.ftm.app.backtest.service;

import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Computes the trading cost drag of a rebalance for an equal-weighted portfolio.
 *
 * <p>Cost is charged on the <em>buy side</em>: the fraction of the new portfolio that had to be
 * purchased to move from the previous allocation to the current one. Entering from cash is full
 * turnover (1.0); an unchanged allocation is zero; replacing k of N equal-weighted names is k/N.
 * The calculator is pure and stateless so it can be unit-tested and injected wherever needed.
 */
@Component
public class TurnoverCostCalculator {

  /** Buy-side turnover fraction in [0, 1] between two equal-weighted allocations. */
  public double turnoverFraction(List<String> previous, List<String> current) {
    if (current == null || current.isEmpty()) return 0.0;
    double currentWeight = 1.0 / current.size();
    double previousWeight = (previous == null || previous.isEmpty()) ? 0.0 : 1.0 / previous.size();

    double bought = 0.0;
    for (String ticker : current) {
      double heldWeight = (previous != null && previous.contains(ticker)) ? previousWeight : 0.0;
      double delta = currentWeight - heldWeight;
      if (delta > 0) bought += delta;
    }
    return bought;
  }

  /**
   * Fraction of portfolio value lost to trading a rebalance, given a per-trade cost in basis points
   * (1 bp = 0.01%). Returns 0 when the cost is non-positive or nothing was bought.
   */
  public double costFraction(List<String> previous, List<String> current, int costBps) {
    if (costBps <= 0) return 0.0;
    return turnoverFraction(previous, current) * (costBps / 10_000.0);
  }
}

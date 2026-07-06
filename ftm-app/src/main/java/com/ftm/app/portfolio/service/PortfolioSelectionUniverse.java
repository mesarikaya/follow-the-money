package com.ftm.app.portfolio.service;

/**
 * Which categories the momentum optimal is allowed to select, plus the hold count that validated
 * best for that universe. The two are coupled deliberately: the top-N-vs-universe sweep showed the
 * choice interacts — equity sectors reward concentration (top-3), while the broader dual-momentum
 * set needs more names to tame metals/bond whipsaw (top-5).
 */
public enum PortfolioSelectionUniverse {

  /** Equity sectors only — the strongest, most robust out-of-sample config (top-3, Sharpe ~0.96). */
  EQUITY_SECTORS(3),

  /** All top-level categories incl. gold, metals and bonds — dual-momentum rotation (top-5). */
  ALL_TOP_LEVEL(5);

  private final int holdCount;

  PortfolioSelectionUniverse(int holdCount) {
    this.holdCount = holdCount;
  }

  public int holdCount() {
    return holdCount;
  }
}

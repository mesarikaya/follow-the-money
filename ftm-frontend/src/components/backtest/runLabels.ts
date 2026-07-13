import { BacktestResult } from "@/lib/api";

/** How a saved run is described in the recent-runs list. */

/**
 * Short label for a saved run's selection signal, e.g. "Mom 12-1", "Comp", or "Comp ⤵inv" when
 * the signal was inverted. Older runs saved before the config was persisted show an em dash.
 */
export function signalLabel(run: BacktestResult): string {
  if (!run.signalSource) return "—";
  const base = run.signalSource === "MOMENTUM_12_1" ? "Mom 12-1" : "Comp";
  return run.invertSignal ? `${base} ⤵inv` : base;
}

/** Compact category-scope label for a saved run, e.g. "Equity" / "All". */
export function scopeLabel(run: BacktestResult): string {
  if (!run.categoryScope) return "—";
  if (run.categoryScope === "EQUITY_SECTOR") return "Equity";
  if (run.categoryScope === "ALL") return "All";
  return run.categoryScope;
}

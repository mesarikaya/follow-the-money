"use client";

import { CategorySummary, HoldingActionDto, PortfolioSelectionUniverse, PortfolioSnapshot } from "@/lib/api";
import PortfolioValueChart from "@/components/PortfolioValueChart";

/** The smaller panels of the portfolio page: the universe switch, the radar, value history, actions. */

export const UniverseSwitcher = ({
  selectionUniverse,
  onSelect,
}: {
  selectionUniverse: PortfolioSelectionUniverse;
  onSelect: (universe: PortfolioSelectionUniverse) => void;
}) => (
  <div className="flex items-center gap-3 flex-wrap">
    <span className="text-xs text-slate-500 uppercase tracking-wider">Recommendation universe</span>
    <div className="inline-flex rounded-md border border-slate-700 overflow-hidden text-xs font-medium">
      <button
        onClick={() => onSelect("EQUITY_SECTORS")}
        className={`px-3 py-1.5 transition-colors ${selectionUniverse === "EQUITY_SECTORS" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        title="Top-3 equity sectors by 12-1 momentum — the strongest, most robust validated config (Sharpe ~0.96). Rotates to cash in a broad equity selloff."
      >
        Equity sectors · top-3
      </button>
      <button
        onClick={() => onSelect("ALL_TOP_LEVEL")}
        className={`px-3 py-1.5 border-l border-slate-700 transition-colors ${selectionUniverse === "ALL_TOP_LEVEL" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        title="Top-5 across all top-level categories incl. gold, metals & bonds — dual-momentum rotation. Weaker out-of-sample evidence (Sharpe ~0.46) and can chase parabolic moves like silver."
      >
        + Metals &amp; Bonds · top-5
      </button>
    </div>
    <span className="text-[10px] text-slate-600">
      {selectionUniverse === "EQUITY_SECTORS"
        ? "Validated config — rotates among equity sectors, to cash in broad selloffs."
        : "Dual-momentum — can rotate into gold / metals / bonds; weaker evidence, higher whipsaw risk."}
    </span>
  </div>
);

export const UnownedBuyRadar = ({ categories }: { categories: CategorySummary[] }) => {
  if (categories.length === 0) return null;
  return (
    <div className="bg-slate-800/50 border border-emerald-900/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-emerald-300">Radar · Unowned BUY Signals</h2>
        <span
          className="text-[10px] text-slate-600 cursor-help"
          title="BUY-signal sectors not currently in your portfolio."
        >
          ⓘ
        </span>
      </div>
      <ul className="space-y-2">
        {categories.map(category => (
          <li key={category.id} className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-slate-500 w-16 shrink-0">{category.id}</span>
            <span className="text-xs text-slate-300 flex-1 truncate">{category.name}</span>
            <span className="text-[9px] font-mono text-emerald-400 shrink-0">
              {category.compositeScore != null ? Math.round(category.compositeScore * 100) : "—"}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/40 shrink-0">
              BUY
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-600 mt-3">
        These sectors have active BUY signals · Add via + Add Holding
      </p>
    </div>
  );
};

/** Until the first snapshot is captured there is nothing to plot — say so rather than show nothing. */
export const PortfolioValueHistory = ({ snapshots }: { snapshots: PortfolioSnapshot[] | null }) => {
  if (snapshots === null) return null;

  if (snapshots.length === 0) {
    return (
      <section className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-400">Portfolio Value History</span>
          <span className="text-[10px] text-slate-600">No snapshots yet</span>
        </div>
        <p className="text-[11px] text-slate-600">
          Click <strong className="text-slate-500">Refresh Prices</strong> to capture today&apos;s
          portfolio value. History builds daily — come back tomorrow to see your first chart.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <PortfolioValueChart snapshots={snapshots} />
    </section>
  );
};

export const ConcentrationRiskBanner = ({
  risk,
}: {
  risk: { name: string; pct: number } | null;
}) => {
  if (!risk) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-900/20 border border-amber-700/40 text-sm">
      <span className="text-amber-400 text-base shrink-0">⚠</span>
      <div>
        <span className="font-semibold text-amber-300">Concentration Risk</span>
        <span className="text-amber-200/70 ml-2">
          {risk.name} is {risk.pct.toFixed(0)}% of your portfolio — consider diversifying across more
          sectors.
        </span>
      </div>
    </div>
  );
};

// Mirrors PortfolioActionEngine's urgency tiers. No WATCH: it belonged to the composite model,
// and the momentum model that now drives these labels has no "not yet BUY-grade" state.
const ACTION_CONFIG: Record<string, { label: string; className: string }> = {
  EXIT:         { label: "EXIT",  className: "bg-red-500/20 text-red-300 border border-red-500/40" },
  TRIM:         { label: "TRIM",  className: "bg-orange-500/15 text-orange-300 border border-orange-500/30" },
  ADD:          { label: "ADD",   className: "bg-sky-500/15 text-sky-300 border border-sky-500/30" },
  HOLD:         { label: "HOLD",  className: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" },
  UNCLASSIFIED: { label: "?",     className: "bg-slate-700/30 text-slate-400 border border-slate-600/30" },
};

const ACTION_ROW_CLASS: Record<string, string> = {
  EXIT: "bg-red-950/10",
  TRIM: "bg-orange-950/10",
  ADD: "bg-sky-950/10",
};

const SIGNAL_COLOR: Record<string, string> = {
  BUY: "text-green-400",
  WATCH: "text-cyan-400",
  HOLD: "text-slate-500",
  REDUCE: "text-red-400",
};

export const RecommendedActionsTable = ({ actions }: { actions: HoldingActionDto[] | null }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Recommended Actions
        </h2>
        <span
          className="text-[10px] text-slate-600 cursor-help"
          title="Driven by 12-1 momentum — the same signal behind the optimal allocation above, so the two always agree. EXIT = negative momentum + position >5% of portfolio. TRIM = negative momentum, smaller position. ADD = among the top-ranked sectors the strategy targets. HOLD = positive momentum but outside the top ranks; keep, don't add. UNCLASSIFIED = no FTM sector mapping. Sorted by urgency."
        >
          (?)
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-700/60">
        <table className="w-full text-xs text-left">
          <thead>
            <tr className="border-b border-slate-700/60 bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px]">
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Ticker</th>
              <th className="px-3 py-2">Sector</th>
              <th className="px-3 py-2 text-center">Signal</th>
              <th className="px-3 py-2 text-center">Conv.</th>
              <th className="px-3 py-2 text-right">Weight</th>
              <th className="px-3 py-2">Rationale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {actions.map(action => {
              const config = ACTION_CONFIG[action.action] ?? ACTION_CONFIG.UNCLASSIFIED;
              return (
                <tr
                  key={action.ticker}
                  className={`hover:bg-slate-800/30 transition-colors ${ACTION_ROW_CLASS[action.action] ?? ""}`}
                >
                  <td className="px-3 py-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${config.className}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono font-semibold text-slate-200">{action.ticker}</td>
                  <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">
                    {action.categoryName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {action.signal ? (
                      <span className={`text-[9px] font-bold ${SIGNAL_COLOR[action.signal] ?? "text-slate-500"}`}>
                        {action.signal}
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center font-mono text-slate-400">
                    {action.convictionScore != null ? action.convictionScore : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-300">
                    {action.portfolioPct != null ? `${Number(action.portfolioPct).toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-500 text-[10px] max-w-[240px]">{action.rationale}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

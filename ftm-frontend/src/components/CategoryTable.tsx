"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CategorySummary, PriceLevelDto, ScoreDecompositionDto, SignalWinRateDto, SubSectorSummary } from "@/lib/api";
import { TradeSignal, deriveTradeSignal } from "@/lib/signals";
import {
  SortDir,
  SortKey,
  buildCategoriesCsv,
  buildRsRankPercentiles,
  filterCategories,
  rsLabelFor,
  sortCategories,
} from "@/lib/categories/categoryTable";
import GlossaryTooltip from "@/components/GlossaryTooltip";
import { CategoryRow } from "@/components/categories/CategoryRow";
import { SortIcon, TYPE_CONFIG } from "@/components/categories/cells";

const TYPE_SECTION_LABELS: Record<string, string> = {
  PRECIOUS_METAL: "Precious Metals",
  FIXED_INCOME:   "Fixed Income",
  CASH:           "Cash",
};

const LEGEND_TYPES = ["EQUITY_SECTOR", "PRECIOUS_METAL", "FIXED_INCOME", "CASH"] as const;

const downloadCsv = (csv: string) => {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `categories-${new Date().toISOString().split("T")[0]}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Focuses the filter box when "/" is pressed anywhere outside another text field. */
const useSlashToFocusFilter = (filterRef: React.RefObject<HTMLInputElement | null>) => {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      event.preventDefault();
      filterRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filterRef]);
};

export default function CategoryTable({
  categories,
  timeframe = "MONTH",
  scoreHistory = {},
  topSubSectors = {},
  allSubSectorsByParent = {},
  priceLevels = {},
  winRates = {},
  scoreComponents = {},
}: {
  categories: CategorySummary[];
  timeframe?: string;
  scoreHistory?: Record<string, number[]>;
  topSubSectors?: Record<string, SubSectorSummary>;
  allSubSectorsByParent?: Record<string, SubSectorSummary[]>;
  priceLevels?: Record<string, PriceLevelDto>;
  winRates?: Record<string, SignalWinRateDto>;
  scoreComponents?: Record<string, ScoreDecompositionDto>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterText, setFilterText] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);

  useSlashToFocusFilter(filterRef);

  const rsLabel = rsLabelFor(timeframe);
  const hasHistory = Object.keys(scoreHistory).length > 0;
  const columnCount = hasHistory ? 9 : 8;
  const isSorted = sortKey !== "default";

  const getSignal = (category: CategorySummary): TradeSignal | null =>
    (category.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(category);

  const visible = sortCategories(
    filterCategories(categories, filterText),
    sortKey,
    sortDir,
    getSignal,
    winRates,
  );
  const rsRankPercentiles = buildRsRankPercentiles(visible);

  /** Sorting a column cycles through: descending → ascending → back to the backend's order. */
  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir(key === "signal" ? "asc" : "desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
      return;
    }
    setSortKey("default");
    setSortDir("desc");
  }

  const resetSort = () => {
    setSortKey("default");
    setSortDir("desc");
  };

  const SortTh = ({ children, sortK, className = "" }: { children: React.ReactNode; sortK: SortKey; className?: string }) => (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-slate-200 transition-colors ${className} ${sortKey === sortK ? "text-cyan-400" : ""}`}
      onClick={() => handleSort(sortK)}
      title={`Sort by ${sortK}`}
    >
      <span className="inline-flex items-center gap-0.5">
        {children}
        <SortIcon active={sortKey === sortK} dir={sortDir} />
      </span>
    </th>
  );

  const SortLabel = ({ sortK, title, children }: { sortK: SortKey; title: string; children: React.ReactNode }) => (
    <span
      className="inline-flex items-center gap-1 cursor-pointer hover:text-slate-200 transition-colors"
      onClick={() => handleSort(sortK)}
      title={title}
    >
      {children}
      <SortIcon active={sortKey === sortK} dir={sortDir} />
    </span>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <div className="px-4 py-2 border-b border-slate-700/60 flex items-center gap-3 bg-slate-800/60">
        <div className="relative flex-1 max-w-xs">
          <input
            ref={filterRef}
            type="text"
            value={filterText}
            onChange={event => setFilterText(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Escape") {
                setFilterText("");
                filterRef.current?.blur();
              }
            }}
            placeholder="Filter by name or ticker…"
            data-testid="category-filter"
            className="w-full bg-slate-900/60 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600/50 transition-colors"
          />
          {!filterText && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-700 font-mono">/</span>
          )}
          {filterText && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              onClick={() => {
                setFilterText("");
                filterRef.current?.focus();
              }}
              aria-label="Clear filter"
            >
              ✕
            </button>
          )}
        </div>
        {filterText && (
          <span className="text-[10px] text-slate-500 shrink-0">
            {visible.length} of {categories.length}
          </span>
        )}
        {isSorted && (
          <div className="flex items-center gap-2 text-[10px] text-cyan-400 ml-auto">
            <span>Sorted by <strong>{sortKey}</strong> {sortDir === "desc" ? "↓" : "↑"}</span>
            <button className="text-slate-500 hover:text-slate-300 transition-colors" onClick={resetSort}>
              ✕ Reset
            </button>
          </div>
        )}
      </div>

      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 w-8">#</th>
            <th className="px-4 py-3">ETF</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <SortTh sortK="close" className="text-right">Close</SortTh>
            {hasHistory && (
              <th className="px-3 py-3 text-center" title="30-day composite score trend (sparkline)">30d Trend</th>
            )}
            <SortTh sortK="score" className="text-center">
              <GlossaryTooltip term="Composite Score">Score</GlossaryTooltip>
            </SortTh>
            <SortTh sortK="rs" className="text-right">
              <GlossaryTooltip term="RS-60">vs Benchmark ({rsLabel})</GlossaryTooltip>
            </SortTh>
            <SortTh sortK="macroFit" className="text-center">
              <GlossaryTooltip term="Macro Fit">Regime</GlossaryTooltip>
            </SortTh>
            <th className="px-4 py-3 text-center">
              <SortLabel sortK="signal" title="Sort by signal priority (BUY → WATCH → HOLD → REDUCE)">
                <GlossaryTooltip term="RRG">Signal</GlossaryTooltip>
              </SortLabel>
              <span className="text-slate-700 mx-1">/</span>
              <SortLabel
                sortK="conviction"
                title="Sort by conviction score (multi-factor: signal quality · macro · percentile · momentum · RS accel)"
              >
                C
              </SortLabel>
              <span className="text-slate-700 mx-1">/</span>
              <SortLabel
                sortK="winrate"
                title="Sort by historical BUY signal win rate (% of BUY signals that returned positively over 30 days)"
              >
                WR
              </SortLabel>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {visible.map((category, index) => {
            const previousType = index > 0 ? visible[index - 1].type : null;
            const showDivider =
              !isSorted && previousType !== category.type && TYPE_SECTION_LABELS[category.type] != null;

            return (
              <Fragment key={category.id}>
                {showDivider && (
                  <tr>
                    <td
                      colSpan={columnCount + 1}
                      className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-900/60 uppercase tracking-widest border-t border-slate-700/60"
                    >
                      {TYPE_SECTION_LABELS[category.type]}
                    </td>
                  </tr>
                )}
                <CategoryRow
                  category={category}
                  displayRank={isSorted ? index + 1 : category.rank}
                  rsLabel={rsLabel}
                  rsRankPercentile={rsRankPercentiles.get(category.id) ?? null}
                  history={scoreHistory[category.id] ?? []}
                  showHistory={hasHistory}
                  topSubSector={topSubSectors[category.id]}
                  allSubSectors={allSubSectorsByParent[category.id]}
                  priceLevel={priceLevels[category.id]}
                  winRate={winRates[category.id]}
                  scoreComponents={scoreComponents[category.id]}
                />
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2.5 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-500 bg-slate-800/40 flex-wrap">
        {LEGEND_TYPES.map(type => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_CONFIG[type].className}`}>
              {TYPE_CONFIG[type].label}
            </span>
          </span>
        ))}
        <span className="text-[10px]" title="Click any column header to sort. Click again to reverse. Click a third time to reset.">
          Click headers to sort · S/R/T = BUY conditions · WR = 30d win rate · ⇅ = sortable
        </span>
        <button
          className="ml-auto text-[10px] px-2 py-0.5 rounded border border-slate-600 text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors"
          onClick={() => downloadCsv(buildCategoriesCsv(visible, rsLabel))}
          title="Export current table data as CSV (respects current sort order)"
          aria-label="Export CSV"
          data-testid="export-csv-button"
        >
          ↓ CSV
        </button>
      </div>
    </div>
  );
}

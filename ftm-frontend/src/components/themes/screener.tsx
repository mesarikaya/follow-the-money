import Link from "next/link";
import { ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import { SECTOR_SHORT_NAMES } from "@/lib/sectors";
import {
  getThemeUniqueSectors,
  phaseAgeDays,
  signalAgeDays,
} from "@/lib/themes/themeMetrics";
import {
  ConfluenceBadge,
  EntryActionBadge,
  MomentumAlignmentBadge,
  PhaseTransitionBadge,
  RiskLevelBadge,
  SIGNAL_CONFIG,
  ThemePhaseBadge,
} from "@/components/themes/badges";


export type ViewPreset = "essential" | "standard" | "full";

export type ScreenerParams = { sort?: string; signal?: string; phase?: string; entry?: string; confidence?: string; view?: string };

export const SECTOR_COLORS: Record<string, string> = {
  TECH: "text-blue-400 bg-blue-900/20 border-blue-700/30",
  HLTH: "text-emerald-400 bg-emerald-900/20 border-emerald-700/30",
  FINL: "text-amber-400 bg-amber-900/20 border-amber-700/30",
  DISR: "text-orange-400 bg-orange-900/20 border-orange-700/30",
  INDU: "text-slate-400 bg-slate-700/30 border-slate-600/30",
  ENRG: "text-yellow-400 bg-yellow-900/20 border-yellow-700/30",
  MATL: "text-lime-400 bg-lime-900/20 border-lime-700/30",
  UTIL: "text-cyan-400 bg-cyan-900/20 border-cyan-700/30",
  REIT: "text-purple-400 bg-purple-900/20 border-purple-700/30",
  STPL: "text-teal-400 bg-teal-900/20 border-teal-700/30",
  COMM: "text-pink-400 bg-pink-900/20 border-pink-700/30",
};

export const ESSENTIAL_COLS = new Set([
  "rank", "rankDelta", "theme", "sector", "signal", "score",
  "trend5d", "phase", "iqs", "bullish", "alerts",
]);

export const STANDARD_COLS = new Set([
  ...ESSENTIAL_COLS,
  "rs60", "entry", "momentum", "trend", "persist", "conf",
]);

export function isVisible(col: string, view: ViewPreset): boolean {
  if (view === "full") return true;
  if (view === "standard") return STANDARD_COLS.has(col);
  return ESSENTIAL_COLS.has(col);
}

export function buildScreenerUrl(current: ScreenerParams, overrides: Partial<ScreenerParams>): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return `/themes${qs ? `?${qs}` : ""}`;
}

export function SortLink({
  label, sortKey, currentSort, title, allParams,
}: {
  label: string; sortKey: string; currentSort: string; title?: string;
  allParams: ScreenerParams;
}) {
  const isActive = currentSort === sortKey;
  return (
    <Link
      href={buildScreenerUrl(allParams, { sort: sortKey })}
      className={`hover:text-slate-300 transition-colors ${isActive ? "text-cyan-400" : "text-slate-600"}`}
      title={title}
    >
      {label}{isActive ? " ↓" : ""}
    </Link>
  );
}

export function FilterChip({
  label, paramKey, value, activeValue, allParams,
}: {
  label: string; paramKey: keyof ScreenerParams; value: string;
  activeValue: string | undefined; allParams: ScreenerParams;
}) {
  const isActive = activeValue === value;
  const href = buildScreenerUrl(allParams, { [paramKey]: isActive ? undefined : value });
  return (
    <Link
      href={href}
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
        isActive
          ? "bg-cyan-500/25 text-cyan-300 border border-cyan-500/40"
          : "bg-slate-700/40 text-slate-500 border border-slate-600/30 hover:text-slate-300 hover:border-slate-500/50"
      }`}
    >
      {isActive && <span className="mr-0.5 text-cyan-400">✕</span>}
      {label}
    </Link>
  );
}

export function ViewSwitcher({ view, allParams }: { view: ViewPreset; allParams: ScreenerParams }) {
  const colCount = view === "full" ? 23 : view === "standard" ? 17 : 11;
  return (
    <div className="flex items-center gap-1.5" data-testid="view-switcher">
      <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mr-0.5">Cols:</span>
      {(["essential", "standard", "full"] as ViewPreset[]).map(v => (
        <Link
          key={v}
          data-testid={`view-${v}`}
          href={buildScreenerUrl(allParams, { view: v === "standard" ? undefined : v })}
          className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
            view === v
              ? "bg-slate-700/60 text-slate-300 border-slate-600/50"
              : "text-slate-600 border-transparent hover:text-slate-400 hover:border-slate-700/40"
          }`}
        >
          {v}
        </Link>
      ))}
      <span className="text-[9px] font-mono text-slate-700">{colCount}c</span>
    </div>
  );
}

export function ThemeScreenerFilterBar({
  allParams, totalCount, filteredCount,
}: {
  allParams: ScreenerParams; totalCount: number; filteredCount: number;
}) {
  const hasActiveFilter = allParams.signal != null || allParams.phase != null || allParams.entry != null || allParams.confidence != null;
  const filterGroups: { label: string; paramKey: keyof ScreenerParams; options: { label: string; value: string }[] }[] = [
    {
      label: "Signal",
      paramKey: "signal",
      options: [
        { label: "BUY", value: "BUY" },
        { label: "WATCH", value: "WATCH" },
        { label: "HOLD", value: "HOLD" },
        { label: "REDUCE", value: "REDUCE" },
      ],
    },
    {
      label: "Phase",
      paramKey: "phase",
      options: [
        { label: "Breakout", value: "BREAKOUT" },
        { label: "Momentum", value: "MOMENTUM" },
        { label: "Setup", value: "SETUP" },
        { label: "Building", value: "BUILDING" },
        { label: "Fading", value: "FADING" },
        { label: "Distribute", value: "DISTRIBUTE" },
        { label: "Weak", value: "WEAK" },
      ],
    },
    {
      label: "Entry",
      paramKey: "entry",
      options: [
        { label: "Enter", value: "ENTER" },
        { label: "Scale In", value: "SCALE_IN" },
        { label: "Watch", value: "WATCH" },
        { label: "Avoid", value: "AVOID" },
      ],
    },
    {
      label: "Confidence",
      paramKey: "confidence",
      options: [
        { label: "High", value: "HIGH_CONFIDENCE" },
        { label: "Moderate", value: "MODERATE" },
        { label: "Cautious", value: "CAUTIOUS" },
        { label: "Avoid", value: "AVOID" },
      ],
    },
  ];
  return (
    <div className="px-3 py-2 border-b border-slate-700/40 bg-slate-800/20 flex flex-wrap items-center gap-3">
      {filterGroups.map(group => (
        <div key={group.paramKey} className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider shrink-0">{group.label}:</span>
          {group.options.map(opt => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              paramKey={group.paramKey}
              value={opt.value}
              activeValue={allParams[group.paramKey]}
              allParams={allParams}
            />
          ))}
        </div>
      ))}
      {hasActiveFilter && (
        <Link
          href={buildScreenerUrl(allParams, { signal: undefined, phase: undefined, entry: undefined, confidence: undefined })}
          className="ml-auto text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
        >
          Clear filters · {filteredCount}/{totalCount}
        </Link>
      )}
      {!hasActiveFilter && (
        <span className="ml-auto text-[10px] font-mono text-slate-600">{totalCount} themes</span>
      )}
    </div>
  );
}

export function ThemeScreener({
  themes,
  allThemes,
  historiesByThemeId,
  alertsByThemeId,
  sort,
  allParams,
  view,
}: {
  themes: ThemeSummary[];
  allThemes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
  alertsByThemeId: Record<string, number>;
  sort: string;
  allParams: ScreenerParams;
  view: ViewPreset;
}) {
  if (allThemes.length === 0) return null;

  const sortedByScore = [...themes].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
  const scoreRankById: Record<string, number> = {};
  sortedByScore.forEach((t, i) => { scoreRankById[t.id] = i + 1; });

  const sorted: ThemeSummary[] = (() => {
    if (sort === "delta5d") {
      return [...themes].sort((a, b) => {
        const histA = historiesByThemeId[a.id] ?? [];
        const histB = historiesByThemeId[b.id] ?? [];
        const dA = histA.length >= 6 ? histA[histA.length - 1].compositeScore - histA[histA.length - 6].compositeScore : -Infinity;
        const dB = histB.length >= 6 ? histB[histB.length - 1].compositeScore - histB[histB.length - 6].compositeScore : -Infinity;
        return dB - dA;
      });
    }
    if (sort === "alerts") {
      return [...themes].sort((a, b) => (alertsByThemeId[b.id] ?? 0) - (alertsByThemeId[a.id] ?? 0) || (b.compositeScore ?? -1) - (a.compositeScore ?? -1));
    }
    if (sort === "rs60") {
      return [...themes].sort((a, b) => (b.rs60 ?? -Infinity) - (a.rs60 ?? -Infinity));
    }
    if (sort === "velocity") {
      const accel = (t: ThemeSummary) =>
        t.compositeTrend5d != null && t.compositeTrend20d != null
          ? t.compositeTrend5d - t.compositeTrend20d : -Infinity;
      return [...themes].sort((a, b) => accel(b) - accel(a));
    }
    if (sort === "percentile") {
      return [...themes].sort((a, b) => (a.scorePercentile30d ?? 1) - (b.scorePercentile30d ?? 1));
    }
    if (sort === "confluence") {
      return [...themes].sort((a, b) => b.confluenceScore - a.confluenceScore);
    }
    if (sort === "persistence") {
      return [...themes].sort((a, b) => b.persistenceScore - a.persistenceScore);
    }
    if (sort === "iqs") {
      return [...themes].sort((a, b) => b.investmentQualityScore - a.investmentQualityScore);
    }
    return sortedByScore;
  })();

  // Rank from 5 days ago: sort by score at history[length - 6] (index 0 = oldest when 30 fetched)
  const LOOKBACK = 5;
  const priorRankById: Record<string, number> = {};
  const priorSorted = [...themes]
    .map(t => {
      const hist = historiesByThemeId[t.id] ?? [];
      const idx = hist.length - 1 - LOOKBACK;
      const score = idx >= 0 ? hist[idx].compositeScore : null;
      return { id: t.id, score };
    })
    .filter(x => x.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  priorSorted.forEach((x, rank) => { priorRankById[x.id] = rank + 1; });

  const columnCount = view === "full" ? 23 : view === "standard" ? 17 : 11;

  return (
    <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Theme Screener · Live Rankings</span>
        <div className="flex items-center gap-3">
          <Link
            href="/themes/correlation"
            className="text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors border border-transparent hover:border-slate-700/40 px-2 py-0.5 rounded"
            title="Signal co-movement matrix — see which themes move together"
            data-testid="correlation-nav-link"
          >
            ⊞ Co-movement
          </Link>
          <Link
            href="/themes/coverage"
            className="text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors border border-transparent hover:border-slate-700/40 px-2 py-0.5 rounded"
            title="Portfolio theme coverage — which themes are gaps in your portfolio"
            data-testid="coverage-nav-link"
          >
            ◎ Coverage
          </Link>
          <ViewSwitcher view={view} allParams={allParams} />
        </div>
      </div>
      <ThemeScreenerFilterBar allParams={allParams} totalCount={allThemes.length} filteredCount={themes.length} />
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-slate-700/40">
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">#</th>
              <th className="py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Δ</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Theme</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Sector</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Signal</th>
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Score" sortKey="score" currentSort={sort} title="Sort by composite score" allParams={allParams} /></th>
              <th className="py-1.5 px-2 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="5d Δ" sortKey="delta5d" currentSort={sort} title="Sort by 5-day score momentum" allParams={allParams} /></th>
              {isVisible("rs60", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="RS-60" sortKey="rs60" currentSort={sort} title="Sort by 60-day relative strength vs SPY" allParams={allParams} /></th>}
              {isVisible("flow", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Flow</th>}
              {isVisible("vsSectors", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">vs Sectors</th>}
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Phase</th>
              {isVisible("transition", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600" title="Server-side phase transition signal">Trans</th>}
              {isVisible("risk", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600" title="Multi-dimension risk score">Risk</th>}
              {isVisible("entry", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600" title="Entry timing advisory — ENTER, SCALE IN, WATCH, or AVOID">Entry</th>}
              {isVisible("momentum", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600" title="5d vs 20d momentum alignment">Mom</th>}
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600">Bullish</th>
              {isVisible("trend", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Trend" sortKey="velocity" currentSort={sort} title="Sort by momentum acceleration (5d trend vs 20d)" allParams={allParams} /></th>}
              {isVisible("percentile", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Pct" sortKey="percentile" currentSort={sort} title="Sort by 30-day score percentile (ascending = cheapest vs recent history)" allParams={allParams} /></th>}
              {isVisible("concentration", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider text-slate-600" title="Sector concentration risk: fraction of constituents in dominant parent sector">Conc</th>}
              {isVisible("persist", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Persist" sortKey="persistence" currentSort={sort} title="Sort by phase persistence grade — how consistently the theme has been in a strong phase over 30 days (A=best)" allParams={allParams} /></th>}
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="IQS" sortKey="iqs" currentSort={sort} title="Sort by Investment Quality Score — composite of signal quality (50%), value zone (20%), diversification (15%), and volatility (15%)" allParams={allParams} /></th>
              {isVisible("conf", view) && <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Conf" sortKey="confluence" currentSort={sort} title="Sort by signal confluence score (0-100)" allParams={allParams} /></th>}
              <th className="py-1.5 px-3 text-[9px] font-semibold uppercase tracking-wider"><SortLink label="Alerts" sortKey="alerts" currentSort={sort} title="Sort by active alert count" allParams={allParams} /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="py-8 text-center">
                  <p className="text-[11px] text-slate-500">No themes match the active filters.</p>
                  <Link
                    href={buildScreenerUrl(allParams, { signal: undefined, phase: undefined, entry: undefined })}
                    className="text-[10px] font-mono text-cyan-500 hover:text-cyan-300 mt-1 inline-block"
                  >
                    Clear filters
                  </Link>
                </td>
              </tr>
            )}
            {sorted.map((t, i) => {
              const rank = i + 1;
              const priorRank = priorRankById[t.id];
              const rankDelta = priorRank != null ? priorRank - rank : null;
              const signal = SIGNAL_CONFIG[t.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
              const pct = t.compositeScore != null ? Math.round(t.compositeScore * 100) : null;
              const scoreClr = t.compositeScore == null ? "text-slate-500"
                : t.compositeScore >= 0.65 ? "text-emerald-400"
                : t.compositeScore >= 0.50 ? "text-cyan-400"
                : t.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
              const barClr = t.compositeScore == null ? "bg-slate-700"
                : t.compositeScore >= 0.65 ? "bg-emerald-500"
                : t.compositeScore >= 0.50 ? "bg-cyan-500"
                : t.compositeScore >= 0.35 ? "bg-amber-500" : "bg-red-500";
              const rsClr = t.rs60 == null ? "text-slate-500"
                : t.rs60 > 0.05 ? "text-emerald-400" : t.rs60 > 0 ? "text-green-400"
                : t.rs60 < -0.05 ? "text-red-400" : "text-amber-400";
              const flowClr = t.flow20d == null ? "text-slate-500"
                : t.flow20d > 0.3 ? "text-emerald-400" : t.flow20d < -0.3 ? "text-red-400" : "text-slate-400";
              const flowArrow = t.flow20d == null ? "—" : t.flow20d > 0.3 ? "↑" : t.flow20d < -0.3 ? "↓" : "→";
              const trendClr = t.compositeTrend20d == null ? "text-slate-500"
                : t.compositeTrend20d > 0.005 ? "text-emerald-400"
                : t.compositeTrend20d < -0.005 ? "text-red-400" : "text-slate-500";
              const trendArrow = t.compositeTrend20d == null ? "—"
                : t.compositeTrend20d > 0.005 ? "↑" : t.compositeTrend20d < -0.005 ? "↓" : "→";
              const accel = t.compositeTrend5d != null && t.compositeTrend20d != null
                ? t.compositeTrend5d - t.compositeTrend20d : null;
              const divPts = t.divergenceFromParentSectors != null ? Math.round(t.divergenceFromParentSectors * 100) : null;
              const bullishPct = t.constituentCount > 0 ? Math.round((t.bullishCount / t.constituentCount) * 100) : 0;
              const themeHistory = historiesByThemeId[t.id] ?? [];
              const ageDays = signalAgeDays(themeHistory, t.dominantSignal);
              const phaseAge = phaseAgeDays(themeHistory, t.themePhase ?? null);
              const scoreDelta5d = themeHistory.length >= 6
                ? Math.round((themeHistory[themeHistory.length - 1].compositeScore - themeHistory[themeHistory.length - 1 - 5].compositeScore) * 100)
                : null;
              const alertCount = alertsByThemeId[t.id] ?? 0;
              return (
                <tr key={t.id} className={`border-t border-slate-700/30 hover:bg-slate-800/50 transition-colors ${alertCount > 0 ? "border-l-2 border-l-amber-500/40" : ""}`}>
                  <td className="py-2 px-3 text-[10px] text-slate-600 font-mono tabular-nums">{rank}</td>
                  <td className="py-2 px-2 text-[9px] font-mono tabular-nums w-8">
                    {rankDelta == null || rankDelta === 0 ? (
                      <span className="text-slate-700">—</span>
                    ) : rankDelta > 0 ? (
                      <span className="text-emerald-400" title={`Moved up ${rankDelta} place${rankDelta !== 1 ? "s" : ""} in 5 days`}>↑{rankDelta}</span>
                    ) : (
                      <span className="text-red-400" title={`Moved down ${Math.abs(rankDelta)} place${Math.abs(rankDelta) !== 1 ? "s" : ""} in 5 days`}>↓{Math.abs(rankDelta)}</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5 group">
                      <Link href={`/themes/${t.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors">
                        {t.name}
                      </Link>
                      <Link
                        href={`/themes/compare?a=${t.id}`}
                        className="text-[9px] font-mono text-slate-700 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
                        title={`Compare ${t.name} with another theme`}
                        data-testid={`screener-compare-link-${t.id}`}
                      >
                        ↔
                      </Link>
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1 flex-wrap">
                      {getThemeUniqueSectors(t).map(sectorId => (
                        <Link
                          key={sectorId}
                          href={`/sectors/${sectorId}`}
                          className={`text-[8px] font-mono px-1 py-0.5 rounded border transition-colors hover:brightness-125 ${SECTOR_COLORS[sectorId] ?? "text-slate-500 bg-slate-800/40 border-slate-700/30"}`}
                          title={`${SECTOR_SHORT_NAMES[sectorId] ?? sectorId} sector`}
                        >
                          {SECTOR_SHORT_NAMES[sectorId]?.slice(0, 5) ?? sectorId.slice(0, 4)}
                        </Link>
                      ))}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${signal.bg} ${signal.color}`}>{signal.label}</span>
                      {ageDays > 0 && ageDays <= 10 && (
                        <span
                          className={`text-[8px] font-mono px-1 py-0.5 rounded ${ageDays <= 3 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25" : "bg-slate-800/60 text-slate-600"}`}
                          title={`In ${t.dominantSignal} for ${ageDays} day${ageDays !== 1 ? "s" : ""}`}
                        >
                          {ageDays <= 3 ? "new " : ""}{ageDays}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-10 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barClr}`} style={{ width: `${pct ?? 0}%` }} />
                      </div>
                      <span className={`text-[10px] font-mono tabular-nums ${scoreClr}`}>{pct ?? "—"}</span>
                      {themeHistory.length >= 5 && (() => {
                        const vals = themeHistory.slice(-14).map(h => h.compositeScore);
                        const lo = Math.min(...vals), hi = Math.max(...vals);
                        const rng = hi - lo;
                        const w = 40, h = 12;
                        const pts = vals.map((v, i) => {
                          const x = (i / (vals.length - 1)) * w;
                          const y = rng > 0 ? h - ((v - lo) / rng) * (h - 2) - 1 : h / 2;
                          return `${x.toFixed(1)},${y.toFixed(1)}`;
                        }).join(" ");
                        const latest = vals[vals.length - 1];
                        const clr = latest >= 0.65 ? "#34d399" : latest >= 0.50 ? "#22d3ee" : latest >= 0.35 ? "#fbbf24" : "#f87171";
                        return (
                          <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="opacity-60 shrink-0">
                            <polyline points={pts} fill="none" stroke={clr} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-[9px] font-mono tabular-nums w-10">
                    {scoreDelta5d == null ? (
                      <span className="text-slate-700">—</span>
                    ) : scoreDelta5d > 0 ? (
                      <span className={scoreDelta5d >= 5 ? "text-emerald-400" : "text-emerald-700"} title={`Score gained +${scoreDelta5d}pt over 5 trading days`}>+{scoreDelta5d}</span>
                    ) : scoreDelta5d < 0 ? (
                      <span className={Math.abs(scoreDelta5d) >= 5 ? "text-red-400" : "text-red-700"} title={`Score lost ${scoreDelta5d}pt over 5 trading days`}>{scoreDelta5d}</span>
                    ) : (
                      <span className="text-slate-700">0</span>
                    )}
                  </td>
                  {isVisible("rs60", view) && <td className="py-2 px-3">
                    <span className={`text-[10px] font-mono tabular-nums ${rsClr}`}>
                      {t.rs60 != null ? `${t.rs60 > 0 ? "+" : ""}${(t.rs60 * 100).toFixed(1)}%` : "—"}
                    </span>
                  </td>}
                  {isVisible("flow", view) && <td className="py-2 px-3">
                    <span className={`text-[10px] font-mono tabular-nums ${flowClr}`}>
                      {t.flow20d != null ? `${flowArrow} ${Math.abs(t.flow20d).toFixed(1)}σ` : "—"}
                    </span>
                  </td>}
                  {isVisible("vsSectors", view) && <td className="py-2 px-3">
                    {divPts != null ? (
                      <span className={`text-[10px] font-mono tabular-nums ${divPts > 2 ? "text-emerald-400" : divPts < -2 ? "text-red-400" : "text-slate-400"}`}>
                        {divPts > 0 ? "+" : ""}{divPts}pt
                      </span>
                    ) : <span className="text-slate-600 text-[10px]">—</span>}
                  </td>}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1">
                      <ThemePhaseBadge phase={t.themePhase ?? null} />
                      {phaseAge > 0 && (
                        <span
                          className={`text-[8px] font-mono tabular-nums shrink-0 ${
                            phaseAge <= 2 ? "text-emerald-400 font-semibold"
                            : phaseAge <= 5 ? "text-slate-400"
                            : "text-slate-700"
                          }`}
                          title={`In ${t.themePhase} phase for ${phaseAge} day${phaseAge !== 1 ? "s" : ""}`}
                        >
                          {phaseAge}d
                        </span>
                      )}
                    </div>
                  </td>
                  {isVisible("transition", view) && <td className="py-2 px-3">
                    <PhaseTransitionBadge signal={t.phaseTransitionSignal ?? null} />
                  </td>}
                  {isVisible("risk", view) && <td className="py-2 px-3">
                    <RiskLevelBadge riskLevel={t.riskLevel ?? null} />
                  </td>}
                  {isVisible("entry", view) && <td className="py-2 px-3">
                    <EntryActionBadge action={t.entryAction ?? null} rationale={t.entryRationale ?? null} />
                  </td>}
                  {isVisible("momentum", view) && <td className="py-2 px-3">
                    <MomentumAlignmentBadge alignment={t.momentumAlignment ?? null} />
                  </td>}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5" title={`${t.bullishCount}/${t.constituentCount} ETFs bullish (BUY or WATCH)`}>
                      <div className="flex h-2 w-10 rounded-full overflow-hidden bg-slate-700 gap-px">
                        {t.constituentCount > 0 && Array.from({ length: t.constituentCount }, (_, j) => (
                          <div
                            key={j}
                            className={`flex-1 ${j < t.bullishCount ? (bullishPct >= 80 ? "bg-emerald-400" : "bg-cyan-500") : "bg-slate-600/40"}`}
                          />
                        ))}
                      </div>
                      <span className={`text-[9px] font-mono tabular-nums ${bullishPct >= 60 ? "text-emerald-400" : bullishPct >= 40 ? "text-amber-400" : "text-slate-600"}`}>
                        {t.bullishCount}/{t.constituentCount}
                      </span>
                    </div>
                  </td>
                  {isVisible("trend", view) && <td className="py-2 px-3">
                    <span className={`text-[10px] font-mono ${trendClr}`}>
                      {trendArrow}{t.compositeTrend20d != null ? ` ${t.compositeTrend20d > 0 ? "+" : ""}${(t.compositeTrend20d * 100).toFixed(1)}pt` : ""}
                      {accel != null && Math.abs(accel) > 0.002 && (
                        <span className={`ml-1 text-[9px] ${accel > 0 ? "text-emerald-300" : "text-red-300"}`}
                          title={`5d vs 20d: ${accel > 0 ? "accelerating" : "decelerating"} ${accel > 0 ? "+" : ""}${(accel * 100).toFixed(1)}pt`}
                        >
                          {accel > 0 ? "⬆" : "⬇"}
                        </span>
                      )}
                    </span>
                  </td>}
                  {isVisible("percentile", view) && <td className="py-2 px-3">
                    {t.scorePercentile30d != null ? (
                      <span
                        data-testid="screener-percentile-badge"
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          t.scorePercentile30d < 0.30
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                            : t.scorePercentile30d < 0.60
                            ? "bg-slate-700/60 text-slate-400 border-slate-600/40"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                        }`}
                        title={`Score at ${Math.round(t.scorePercentile30d * 100)}th percentile of last 30 days — ${t.scorePercentile30d < 0.40 ? "historically cheap" : t.scorePercentile30d > 0.80 ? "near 30d high" : "mid-range"}`}
                      >
                        P{Math.round(t.scorePercentile30d * 100)}
                      </span>
                    ) : (
                      <span className="text-slate-700 text-[10px]">—</span>
                    )}
                  </td>}
                  {isVisible("concentration", view) && <td className="py-2 px-3" data-testid="screener-concentration-cell">
                    {t.concentrationRisk != null ? (
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
                          t.concentrationRisk > 0.80
                            ? "bg-red-500/10 text-red-400 border-red-500/20"
                            : t.concentrationRisk > 0.50
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}
                        title={`Sector concentration: ${Math.round(t.concentrationRisk * 100)}% of constituents in dominant parent sector. >80% = single-sector risk`}
                      >
                        {t.concentrationRisk > 0.80 ? "CONC" : t.concentrationRisk > 0.50 ? "MOD" : "DIV"}
                      </span>
                    ) : (
                      <span className="text-slate-700 text-[10px]">—</span>
                    )}
                  </td>}
                  {isVisible("persist", view) && <td className="py-2 px-3" data-testid="screener-persistence-cell">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        t.persistenceGrade === "A"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : t.persistenceGrade === "B"
                          ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
                          : t.persistenceGrade === "C"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : t.persistenceGrade === "D"
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}
                      title={`Phase persistence: ${t.persistenceScore}% of last 30 days in a strong phase (BREAKOUT/MOMENTUM/SETUP)`}
                    >
                      {t.persistenceGrade}
                    </span>
                  </td>}
                  <td className="py-2 px-3" data-testid="screener-iqs-cell">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        t.investmentQualityGrade === "A"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                          : t.investmentQualityGrade === "B"
                          ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/25"
                          : t.investmentQualityGrade === "C"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : t.investmentQualityGrade === "D"
                          ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}
                      title={`Investment Quality Score: ${t.investmentQualityScore}/100 — signal quality (50%), value zone (20%), diversification (15%), volatility (15%)`}
                    >
                      {t.investmentQualityGrade}
                    </span>
                  </td>
                  {isVisible("conf", view) && <td className="py-2 px-3">
                    <ConfluenceBadge confluenceScore={t.confluenceScore} confidenceLabel={t.confidenceLabel} />
                  </td>}
                  <td className="py-2 px-3">
                    {alertCount > 0 ? (
                      <span
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25"
                        title={`${alertCount} active alert${alertCount !== 1 ? "s" : ""}`}
                      >
                        {alertCount}!
                      </span>
                    ) : (
                      <span className="text-slate-700 text-[10px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


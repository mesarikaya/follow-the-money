import Link from "next/link";
import { fetchThemes, fetchThemeHistory, fetchAlerts, fetchRecentAlerts, fetchRotationScore, AlertDto, ThemeSummary, ThemeHistoryPoint, CapitalRotationData } from "@/lib/api";
import { scoreColor, signalAgeDays, phaseAgeDays, getThemeUniqueSectors, themeShortLabel } from "@/lib/themes/themeMetrics";
import { SIGNAL_CONFIG, ScoreArc, FlowChip, TrendChip, EtfBubble, DivergenceChip, ThemeSparkline, ScoreDeltaBadge, ThemePhaseBadge, PhaseTransitionBadge, RiskLevelBadge, MomentumAlignmentBadge, EntryActionBadge, ConfluenceBadge, SignalFreshnessBadge, BullishBar } from "@/components/themes/badges";
import { ThemePlaybook, PreBuySetupPanel, ThemeTippingPoints, TopOpportunitiesPanel, ThemeNarrative } from "@/components/themes/panels";
import { ActiveRotationBanner, RotationMomentumStrip, ThemeEventsFeed, ThemeAlertFeed } from "@/components/themes/panels";
import ThemeAlertRiskMap from "@/components/ThemeAlertRiskMap";
import ThemeBuyCountdown from "@/components/ThemeBuyCountdown";
import ThemeScoreZPanel from "@/components/ThemeScoreZPanel";
import ThemeSignalStreakPanel from "@/components/ThemeSignalStreakPanel";
import { SECTOR_SHORT_NAMES } from "@/lib/sectors";




























function ThemeCard({ theme, history }: { theme: ThemeSummary; history: ThemeHistoryPoint[] }) {
  const signal = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;

  return (
    <Link href={`/themes/${theme.id}`} className="block group">
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-4 hover:border-slate-500/80 hover:bg-slate-800 transition-all duration-150 group-hover:shadow-lg group-hover:shadow-black/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight mb-1 truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
              {theme.name}
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">{theme.thesis}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <ScoreArc score={theme.compositeScore} />
            <ThemeSparkline history={history} />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${signal.bg} ${signal.color}`}>
            {signal.label}
          </span>
          <ThemePhaseBadge phase={theme.themePhase} />
          <PhaseTransitionBadge signal={theme.phaseTransitionSignal} />
          <RiskLevelBadge riskLevel={theme.riskLevel} />
          <EntryActionBadge action={theme.entryAction} rationale={theme.entryRationale} />
          <ConfluenceBadge confluenceScore={theme.confluenceScore} confidenceLabel={theme.confidenceLabel} />
          <MomentumAlignmentBadge alignment={theme.momentumAlignment} />
          <SignalFreshnessBadge history={history} signal={theme.dominantSignal} />
          <ScoreDeltaBadge history={history} />
          <FlowChip flow={theme.flow20d} />
          <TrendChip trend={theme.compositeTrend20d} />
          <DivergenceChip divergence={theme.divergenceFromParentSectors} />
          {theme.rs60 != null && (
            <span
              className={`text-[10px] font-mono ${scoreColor(theme.rs60 > 0 ? 0.65 : 0.3)}`}
              title={`Avg RS-60: ${theme.rs60 > 0 ? "+" : ""}${(theme.rs60 * 100).toFixed(1)}%`}
            >
              RS {theme.rs60 > 0 ? "+" : ""}{(theme.rs60 * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <BullishBar bullish={theme.bullishCount} total={theme.constituentCount} />

        <div className="flex flex-wrap gap-1 mt-2.5">
          {theme.topConstituents.map(c => <EtfBubble key={c.categoryId} c={c} />)}
          {theme.constituentCount > theme.topConstituents.length && (
            <span className="text-[9px] font-mono text-slate-600">
              +{theme.constituentCount - theme.topConstituents.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}














function ThemeRelativeStrengthPlot({ themes }: { themes: ThemeSummary[] }) {
  const plotThemes = themes.filter(
    t => t.divergenceFromParentSectors != null && t.compositeTrend20d != null
  );
  if (plotThemes.length < 2) return null;

  const W = 420, H = 140;
  const padX = 40, padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const divValues = plotThemes.map(t => t.divergenceFromParentSectors!);
  const velValues = plotThemes.map(t => t.compositeTrend20d!);
  const maxAbsDiv = Math.max(0.12, ...divValues.map(Math.abs)) * 1.15;
  const maxAbsVel = Math.max(0.008, ...velValues.map(Math.abs)) * 1.15;

  const toX = (div: number) => padX + ((div + maxAbsDiv) / (2 * maxAbsDiv)) * chartW;
  const toY = (vel: number) => padY + ((maxAbsVel - vel) / (2 * maxAbsVel)) * chartH;
  const midX = toX(0);
  const midY = toY(0);

  const FILL: Record<string, string> = {
    BUY:    "#34d39990",
    WATCH:  "#22d3ee90",
    HOLD:   "#64748b80",
    REDUCE: "#f8717190",
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">theme positioning · divergence vs velocity</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          <span>← lagging sectors</span>
          <span>leading sectors →</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Quadrant backgrounds */}
        <rect x={midX} y={padY} width={padX + chartW - midX} height={midY - padY} fill="#34d39905" />
        <rect x={padX} y={midY} width={midX - padX} height={padY + chartH - midY} fill="#f8717105" />
        {/* Axes */}
        <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="#334155" strokeWidth="1" />
        <line x1={midX} y1={padY} x2={midX} y2={H - padY} stroke="#334155" strokeWidth="1" />
        {/* Axis labels */}
        <text x={padX} y={midY - 3} fill="#475569" fontSize="7" fontFamily="monospace">velocity</text>
        <text x={W - padX - 2} y={midY + 10} fill="#475569" fontSize="7" textAnchor="end" fontFamily="monospace">vs sectors</text>
        {/* Dots */}
        {plotThemes.map(t => {
          const cx = toX(t.divergenceFromParentSectors!);
          const cy = toY(t.compositeTrend20d!);
          const fill = FILL[t.dominantSignal] ?? FILL.HOLD;
          const scorePct = t.compositeScore != null ? t.compositeScore : 0.5;
          const r = 4 + scorePct * 5;
          const label = themeShortLabel(t);
          const labelRight = cx > W * 0.7;
          return (
            <g key={t.id}>
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={fill.slice(0, 7)} strokeWidth="1" strokeOpacity="0.8" />
              <text
                x={labelRight ? cx - r - 2 : cx + r + 2}
                y={cy + 3}
                fill="#94a3b8"
                fontSize="7"
                textAnchor={labelRight ? "end" : "start"}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
        {/* Quadrant corner labels */}
        <text x={W - padX - 2} y={padY + 10} fill="#34d39930" fontSize="6" textAnchor="end" fontFamily="monospace">LEADING ↑</text>
        <text x={padX + 2} y={H - padY - 3} fill="#f8717130" fontSize="6" fontFamily="monospace">LAGGING ↓</text>
      </svg>
    </div>
  );
}

const SIGNAL_STROKE: Record<string, string> = {
  BUY:    "#34d399",
  WATCH:  "#22d3ee",
  HOLD:   "#64748b",
  REDUCE: "#f87171",
};

function ThemePositioningMatrix({ themes }: { themes: ThemeSummary[] }) {
  const plotThemes = themes.filter(
    t => t.compositeScore != null && t.flow20d != null
  );
  if (plotThemes.length < 2) return null;

  const W = 420, H = 160;
  const padX = 36, padY = 18;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const maxAbsFlow = Math.max(2.0, ...plotThemes.map(t => Math.abs(t.flow20d!))) * 1.1;
  const minScore = Math.max(0, Math.min(...plotThemes.map(t => t.compositeScore!)) - 0.08);
  const maxScore = Math.min(1, Math.max(...plotThemes.map(t => t.compositeScore!)) + 0.08);
  const scoreRange = maxScore - minScore || 0.5;

  const toX = (score: number) => padX + ((score - minScore) / scoreRange) * chartW;
  const toY = (flow: number) => padY + ((maxAbsFlow - flow) / (2 * maxAbsFlow)) * chartH;

  const midY = toY(0);
  const buyX = toX(0.65);

  const FILL: Record<string, string> = {
    BUY:    "#34d39990",
    WATCH:  "#22d3ee90",
    HOLD:   "#64748b80",
    REDUCE: "#f8717190",
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">positioning matrix · score vs flow</span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          <span>score →</span>
          <span>flow ↕</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {/* Quadrant fills */}
        <rect x={buyX} y={padY} width={W - padX - buyX} height={midY - padY} fill="#34d39904" />
        <rect x={buyX} y={midY} width={W - padX - buyX} height={padY + chartH - midY} fill="#f8717103" />
        {/* BUY threshold line */}
        <line x1={buyX} y1={padY} x2={buyX} y2={H - padY} stroke="#34d39930" strokeWidth="1" strokeDasharray="3 2" />
        <text x={buyX + 2} y={padY + 8} fill="#34d39940" fontSize="6" fontFamily="monospace">BUY 65</text>
        {/* Zero flow axis */}
        <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="#334155" strokeWidth="1" />
        {/* Left axis */}
        <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="#1e293b" strokeWidth="1" />
        {/* Quadrant corner labels */}
        <text x={buyX + 4} y={padY + 8} fill="#34d39928" fontSize="6" fontFamily="monospace"> </text>
        <text x={W - padX - 2} y={padY + 10} fill="#34d39935" fontSize="6" textAnchor="end" fontFamily="monospace">LEADERS</text>
        <text x={W - padX - 2} y={H - padY - 3} fill="#f8717125" fontSize="6" textAnchor="end" fontFamily="monospace">DISTRIBUTION</text>
        <text x={padX + 2} y={padY + 10} fill="#22d3ee25" fontSize="6" fontFamily="monospace">ACCUMULATORS</text>
        <text x={padX + 2} y={H - padY - 3} fill="#64748b40" fontSize="6" fontFamily="monospace">AVOID</text>
        {/* Flow axis labels */}
        <text x={padX - 2} y={padY + 8} fill="#475569" fontSize="6" textAnchor="end" fontFamily="monospace">+{maxAbsFlow.toFixed(1)}σ</text>
        <text x={padX - 2} y={H - padY + 1} fill="#475569" fontSize="6" textAnchor="end" fontFamily="monospace">-{maxAbsFlow.toFixed(1)}σ</text>
        {/* Dots */}
        {plotThemes.map(t => {
          const cx = toX(t.compositeScore!);
          const cy = toY(t.flow20d!);
          const fill = FILL[t.dominantSignal] ?? FILL.HOLD;
          const bullishRatio = t.constituentCount > 0 ? t.bullishCount / t.constituentCount : 0.5;
          const r = 3.5 + bullishRatio * 4.5;
          const label = themeShortLabel(t);
          const labelRight = cx > W * 0.75;
          return (
            <g key={t.id}>
              <circle cx={cx} cy={cy} r={r} fill={fill} stroke={fill.slice(0, 7)} strokeWidth="1" strokeOpacity="0.8" />
              <text
                x={labelRight ? cx - r - 2 : cx + r + 2}
                y={cy + 3}
                fill="#94a3b8"
                fontSize="7"
                textAnchor={labelRight ? "end" : "start"}
                fontFamily="monospace"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const SECTOR_COLORS: Record<string, string> = {
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


type ViewPreset = "essential" | "standard" | "full";

type ScreenerParams = { sort?: string; signal?: string; phase?: string; entry?: string; confidence?: string; view?: string };

const ESSENTIAL_COLS = new Set([
  "rank", "rankDelta", "theme", "sector", "signal", "score",
  "trend5d", "phase", "iqs", "bullish", "alerts",
]);

const STANDARD_COLS = new Set([
  ...ESSENTIAL_COLS,
  "rs60", "entry", "momentum", "trend", "persist", "conf",
]);

function isVisible(col: string, view: ViewPreset): boolean {
  if (view === "full") return true;
  if (view === "standard") return STANDARD_COLS.has(col);
  return ESSENTIAL_COLS.has(col);
}

function buildScreenerUrl(current: ScreenerParams, overrides: Partial<ScreenerParams>): string {
  const merged = { ...current, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v != null && v !== "") params.set(k, v);
  }
  const qs = params.toString();
  return `/themes${qs ? `?${qs}` : ""}`;
}

function SortLink({
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

function FilterChip({
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

function ViewSwitcher({ view, allParams }: { view: ViewPreset; allParams: ScreenerParams }) {
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

function ThemeScreenerFilterBar({
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

function ThemeScreener({
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


function ThemeScoreHeatmap({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const DAYS = 20;

  // Collect all unique dates across all themes, take latest DAYS
  const allDates = Array.from(
    new Set(
      Object.values(historiesByThemeId)
        .flat()
        .map(h => h.date)
    )
  ).sort().slice(-DAYS);

  if (allDates.length < 5) return null;

  const sortedThemes = [...themes]
    .filter(t => (historiesByThemeId[t.id]?.length ?? 0) >= 3)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (sortedThemes.length === 0) return null;

  const scoreByThemeDate: Record<string, Record<string, number>> = {};
  for (const t of sortedThemes) {
    scoreByThemeDate[t.id] = {};
    for (const h of historiesByThemeId[t.id] ?? []) {
      scoreByThemeDate[t.id][h.date] = h.compositeScore;
    }
  }

  const cellColor = (score: number | undefined): string => {
    if (score == null) return "bg-slate-800/40";
    if (score >= 0.70) return "bg-emerald-500";
    if (score >= 0.65) return "bg-emerald-600/80";
    if (score >= 0.55) return "bg-cyan-600/70";
    if (score >= 0.50) return "bg-cyan-700/60";
    if (score >= 0.40) return "bg-amber-700/60";
    if (score >= 0.35) return "bg-red-700/60";
    return "bg-red-800/50";
  };

  // Show column labels every 5 days
  const dateLabels = allDates.map((d, i) => {
    const showLabel = i === 0 || i === allDates.length - 1 || (allDates.length - 1 - i) % 5 === 0;
    if (!showLabel) return null;
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Score Heatmap</span>
        <span className="text-[10px] text-slate-600 font-mono">last {allDates.length} trading days · red→amber→green = 0→100</span>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="text-[9px] font-mono w-full" style={{ minWidth: `${allDates.length * 14 + 120}px` }}>
          <thead>
            <tr>
              <th className="text-left text-slate-600 font-normal pb-1 pr-2 w-28">Theme</th>
              {allDates.map((d, i) => (
                <th key={d} className="text-center text-slate-600 font-normal pb-1 w-3" style={{ minWidth: "12px" }}>
                  {dateLabels[i] ? (
                    <span className="block" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", lineHeight: 1 }}>
                      {dateLabels[i]}
                    </span>
                  ) : null}
                </th>
              ))}
              <th className="text-center text-slate-600 font-normal pb-1 pl-2">Now</th>
            </tr>
          </thead>
          <tbody>
            {sortedThemes.map(t => {
              const scores = scoreByThemeDate[t.id];
              const currentPct = t.compositeScore != null ? Math.round(t.compositeScore * 100) : null;
              const currentClr = t.compositeScore == null ? "text-slate-600"
                : t.compositeScore >= 0.65 ? "text-emerald-400"
                : t.compositeScore >= 0.50 ? "text-cyan-400"
                : t.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
              return (
                <tr key={t.id}>
                  <td className="py-0.5 pr-2 text-slate-400 truncate max-w-[112px]" style={{ maxWidth: "112px" }}>
                    <a href={`/themes/${t.id}`} className="hover:text-cyan-300 transition-colors truncate block">
                      {t.name.length > 16 ? t.name.slice(0, 15) + "…" : t.name}
                    </a>
                  </td>
                  {allDates.map(d => {
                    const score = scores[d];
                    return (
                      <td key={d} className="py-0.5 px-px" title={score != null ? `${t.name}: ${Math.round(score * 100)} (${d})` : `${t.name}: no data (${d})`}>
                        <div className={`w-2.5 h-2.5 rounded-sm ${cellColor(score)}`} />
                      </td>
                    );
                  })}
                  <td className={`py-0.5 pl-2 font-semibold ${currentClr} text-center`}>{currentPct ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThemeRaceChart({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const validThemes = themes.filter(t => (historiesByThemeId[t.id]?.length ?? 0) >= 3);
  if (validThemes.length < 2) return null;

  const width = 600, height = 100;
  const padLeft = 4, padRight = 90, padTop = 8, padBottom = 16;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const allPoints = validThemes.flatMap(t => historiesByThemeId[t.id].map(h => h.compositeScore));
  const globalMin = Math.max(0, Math.min(...allPoints) - 0.05);
  const globalMax = Math.min(1, Math.max(...allPoints) + 0.05);
  const yRange = globalMax - globalMin;

  const toY = (v: number) => padTop + chartHeight - ((v - globalMin) / yRange) * chartHeight;
  const buyY = toY(0.65);
  const reduceY = toY(0.35);

  const sortedByLatestScore = [...validThemes].sort((a, b) => {
    const aHist = historiesByThemeId[a.id];
    const bHist = historiesByThemeId[b.id];
    const aLast = aHist[aHist.length - 1]?.compositeScore ?? 0;
    const bLast = bHist[bHist.length - 1]?.compositeScore ?? 0;
    return bLast - aLast;
  });

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">30-day theme race · composite score</span>
        <span className="text-[10px] font-mono text-slate-600">all themes overlaid</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        {/* BUY threshold */}
        <line x1={padLeft} y1={buyY} x2={width - padRight} y2={buyY} stroke="#34d39920" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft} y={buyY - 2} fill="#34d39950" fontSize="6" fontFamily="monospace">BUY 65</text>
        {/* REDUCE threshold */}
        <line x1={padLeft} y1={reduceY} x2={width - padRight} y2={reduceY} stroke="#f8717120" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft} y={reduceY - 2} fill="#f8717150" fontSize="6" fontFamily="monospace">REDUCE 35</text>

        {validThemes.map(t => {
          const hist = historiesByThemeId[t.id];
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? "#64748b";
          const points = hist.map((h, i) => {
            const x = padLeft + (i / (hist.length - 1)) * chartWidth;
            const y = toY(h.compositeScore);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          const lastX = (padLeft + chartWidth).toFixed(1);
          const lastY = toY(hist[hist.length - 1].compositeScore).toFixed(1);
          return (
            <g key={t.id}>
              <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.2" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} fillOpacity="0.9" />
            </g>
          );
        })}

        {/* End-point labels stacked on right, sorted by score */}
        {sortedByLatestScore.map((t, rank) => {
          const hist = historiesByThemeId[t.id];
          const score = hist[hist.length - 1]?.compositeScore ?? 0;
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? "#64748b";
          const labelY = padTop + (rank * (chartHeight / (sortedByLatestScore.length - 1 || 1)));
          const lastX = padLeft + chartWidth;
          const lastY = toY(score);
          return (
            <g key={`label-${t.id}`}>
              <line x1={lastX + 2} y1={lastY} x2={lastX + 8} y2={labelY + 3} stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
              <text x={lastX + 10} y={labelY + 4} fill={stroke} fontSize="7" fontFamily="monospace" fontWeight="500">
                {themeShortLabel(t)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const RISK_ORDINAL: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, EXTREME: 3 };
const RISK_COLORS: Record<string, string> = {
  LOW:     "#34d399",
  MEDIUM:  "#94a3b8",
  HIGH:    "#fbbf24",
  EXTREME: "#f87171",
};
const RISK_LABELS = ["LOW", "MEDIUM", "HIGH", "EXTREME"];

function ThemeRiskMatrixPanel({ themes }: { themes: ThemeSummary[] }) {
  const plotThemes = themes.filter(t => t.compositeScore != null && t.riskLevel != null);
  if (plotThemes.length < 2) return null;

  const W = 540, H = 200, padX = 60, padY = 28, plotW = W - padX * 2, plotH = H - padY * 2;
  const scoreToX = (s: number) => padX + s * plotW;
  const riskToY = (r: string) => padY + ((RISK_ORDINAL[r] ?? 1) / 3) * plotH;

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Risk vs Score Matrix</span>
        <span className="text-[10px] text-slate-600 font-mono">opportunity (high score, low risk) at top-right</span>
      </div>
      <div className="px-3 py-2">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
          {/* quadrant shading */}
          <rect x={padX + 0.65 * plotW} y={padY} width={0.35 * plotW} height={plotH / 2} fill="#34d39908" />
          <rect x={padX} y={padY + plotH / 2} width={0.65 * plotW} height={plotH / 2} fill="#f8717108" />

          {/* BUY threshold line */}
          <line x1={padX + 0.65 * plotW} y1={padY} x2={padX + 0.65 * plotW} y2={padY + plotH}
            stroke="#34d399" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.4" />
          <line x1={padX} y1={padY + plotH / 2} x2={padX + plotW} y2={padY + plotH / 2}
            stroke="#94a3b8" strokeWidth="0.6" strokeDasharray="3 3" opacity="0.3" />

          {/* axes labels */}
          {RISK_LABELS.map((label, i) => (
            <text key={label} x={padX - 4} y={padY + (i / 3) * plotH + 4}
              fill="#64748b" fontSize="7" fontFamily="monospace" textAnchor="end">
              {label.slice(0, 3)}
            </text>
          ))}
          {[0, 0.25, 0.5, 0.65, 0.75, 1.0].map(v => (
            <text key={v} x={scoreToX(v)} y={padY + plotH + 10}
              fill="#475569" fontSize="7" fontFamily="monospace" textAnchor="middle">
              {Math.round(v * 100)}
            </text>
          ))}

          {/* quadrant labels */}
          <text x={padX + 0.68 * plotW + 4} y={padY + 8} fill="#34d39960" fontSize="6.5" fontFamily="monospace">BEST</text>
          <text x={padX + 4} y={padY + plotH - 4} fill="#f8717160" fontSize="6.5" fontFamily="monospace">AVOID</text>

          {/* dots */}
          {plotThemes.map(t => {
            const x = scoreToX(t.compositeScore!);
            const y = riskToY(t.riskLevel!);
            const fill = RISK_COLORS[t.riskLevel!] ?? "#94a3b8";
            const label = t.name.split(" ").slice(0, 2).join(" ");
            return (
              <g key={t.id}>
                <circle cx={x} cy={y} r={5} fill={fill} fillOpacity={0.8} />
                <text x={x} y={y - 8} fill={fill} fontSize="6" fontFamily="monospace"
                  textAnchor="middle" opacity="0.85">{label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function ThemeEntryAdvisorPanel({ themes }: { themes: ThemeSummary[] }) {
  const actionable = themes
    .filter(t => t.entryAction === "ENTER" || t.entryAction === "SCALE_IN")
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const watches = themes
    .filter(t => t.entryAction === "WATCH")
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (actionable.length === 0 && watches.length === 0) return null;

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Entry Timing Advisor</span>
        <span className="text-[10px] text-slate-600 font-mono">chain-of-responsibility · {actionable.length} actionable</span>
      </div>
      <div className="divide-y divide-slate-700/20">
        {actionable.map(t => (
          <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
            <EntryActionBadge action={t.entryAction} rationale={null} />
            <span className="text-[11px] font-medium text-slate-200 min-w-0 flex-1 truncate">{t.name}</span>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {t.compositeScore != null ? Math.round(t.compositeScore * 100) : "—"}
            </span>
            <span className="text-[9px] text-slate-500 max-w-[260px] truncate hidden sm:block" title={t.entryRationale ?? ""}>
              {t.entryRationale}
            </span>
          </div>
        ))}
        {watches.length > 0 && (
          <div className="px-4 py-2 bg-slate-800/20">
            <div className="text-[9px] font-mono text-slate-600 uppercase mb-1.5">Watchlist — approaching BUY zone</div>
            <div className="flex flex-wrap gap-2">
              {watches.map(t => (
                <div key={t.id} className="flex items-center gap-1.5 bg-slate-700/30 rounded px-2 py-1">
                  <span className="text-[10px] text-amber-300 font-mono">◉</span>
                  <span className="text-[10px] text-slate-300">{t.name}</span>
                  <span className="text-[9px] font-mono text-slate-500">
                    {t.compositeScore != null ? Math.round(t.compositeScore * 100) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CapitalRotationPanel({ data }: { data: CapitalRotationData }) {
  const INTENSITY_CONFIG: Record<string, { label: string; className: string; barColor: string }> = {
    STRONG:        { label: "STRONG ROTATION",  className: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30", barColor: "bg-emerald-500" },
    MODERATE:      { label: "MODERATE ROTATION", className: "text-cyan-300 bg-cyan-500/15 border-cyan-500/30",          barColor: "bg-cyan-500" },
    LOW:           { label: "LOW ROTATION",      className: "text-amber-300 bg-amber-500/15 border-amber-500/30",       barColor: "bg-amber-500" },
    CONSOLIDATING: { label: "CONSOLIDATING",     className: "text-slate-400 bg-slate-700/40 border-slate-600/40",       barColor: "bg-slate-500" },
  };
  const cfg = INTENSITY_CONFIG[data.intensityLabel] ?? INTENSITY_CONFIG.CONSOLIDATING;
  const scorePct = Math.round(data.rotationScore * 100);
  const dispersionPct = Math.round(data.scoreDispersion * 100);
  const alignmentPct = Math.round(data.trendAlignment * 100);
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-3">
        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Capital Rotation Score</span>
        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${cfg.className}`}>
          {cfg.label}
        </span>
        <span className="ml-auto text-[11px] font-mono font-bold text-slate-200">{scorePct}</span>
        <span className="text-[9px] font-mono text-slate-600">/100</span>
      </div>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase">Score Dispersion</span>
              <span className="text-[10px] font-mono text-slate-400">{dispersionPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cfg.barColor} opacity-80`} style={{ width: `${dispersionPct}%` }} />
            </div>
            <p className="text-[9px] text-slate-600 mt-0.5">IQR of composite scores — wider = more dispersed capital</p>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[9px] font-mono text-slate-500 uppercase">Trend Alignment</span>
              <span className="text-[10px] font-mono text-slate-400">{alignmentPct}%</span>
            </div>
            <div className="h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${cfg.barColor} opacity-80`} style={{ width: `${alignmentPct}%` }} />
            </div>
            <p className="text-[9px] text-slate-600 mt-0.5">Winners trending up + losers trending down simultaneously</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {data.leadingThemeNames.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-emerald-600 uppercase mb-1.5">Leading</div>
              <div className="flex flex-col gap-1">
                {data.leadingThemeNames.map((name, i) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-600">#{i + 1}</span>
                    <span className="text-[10px] text-slate-300 truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.laggingThemeNames.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-red-700 uppercase mb-1.5">Lagging</div>
              <div className="flex flex-col gap-1">
                {data.laggingThemeNames.map((name) => (
                  <div key={name} className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono text-slate-600">↓</span>
                    <span className="text-[10px] text-slate-500 truncate">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MomentumDivergencePanel({ themes }: { themes: ThemeSummary[] }) {
  const fading = themes.filter(t => t.momentumAlignment === "FADING" && t.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const recovering = themes.filter(t => t.momentumAlignment === "RECOVERING" && t.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  if (fading.length === 0 && recovering.length === 0) return null;
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
        <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">Momentum Divergence</span>
        <span className="text-[9px] text-slate-600">5d vs 20d trend misalignment signals</span>
      </div>
      <div className="divide-y divide-slate-700/30">
        {recovering.length > 0 && (
          <div className="px-4 py-2.5">
            <div className="text-[9px] font-mono text-teal-600 uppercase mb-2">Recovering — dip in healthy uptrend</div>
            <div className="flex flex-col gap-1.5">
              {recovering.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <MomentumAlignmentBadge alignment="RECOVERING" />
                  <span className="text-[11px] font-medium text-slate-200 flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    score {Math.round((t.compositeScore ?? 0) * 100)}
                  </span>
                  <span className="text-[9px] font-mono text-teal-400">
                    5d {t.compositeTrend5d != null ? `${t.compositeTrend5d > 0 ? "+" : ""}${(t.compositeTrend5d * 100).toFixed(1)}pt` : "—"}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400">
                    20d {t.compositeTrend20d != null ? `+${(t.compositeTrend20d * 100).toFixed(1)}pt` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {fading.length > 0 && (
          <div className="px-4 py-2.5">
            <div className="text-[9px] font-mono text-amber-600 uppercase mb-2">Fading — short bounce in declining trend</div>
            <div className="flex flex-col gap-1.5">
              {fading.map(t => (
                <div key={t.id} className="flex items-center gap-2.5">
                  <MomentumAlignmentBadge alignment="FADING" />
                  <span className="text-[11px] font-medium text-slate-200 flex-1 truncate">{t.name}</span>
                  <span className="text-[10px] font-mono text-slate-400">
                    score {Math.round((t.compositeScore ?? 0) * 100)}
                  </span>
                  <span className="text-[9px] font-mono text-amber-400">
                    5d +{t.compositeTrend5d != null ? `${(t.compositeTrend5d * 100).toFixed(1)}pt` : "—"}
                  </span>
                  <span className="text-[9px] font-mono text-red-400">
                    20d {t.compositeTrend20d != null ? `${(t.compositeTrend20d * 100).toFixed(1)}pt` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; signal?: string; phase?: string; entry?: string; confidence?: string; view?: string }>;
}) {
  const { sort: sortParam, signal: signalFilter, phase: phaseFilter, entry: entryFilter, confidence: confidenceFilter, view: viewParam } = await searchParams;
  const screenerSort = ["score", "delta5d", "alerts", "rs60", "velocity", "percentile", "confluence", "persistence", "iqs"].includes(sortParam ?? "") ? sortParam as string : "score";
  const view: ViewPreset = viewParam === "essential" ? "essential" : viewParam === "full" ? "full" : "standard";
  const allParams: ScreenerParams = {
    sort: sortParam,
    signal: signalFilter,
    phase: phaseFilter,
    entry: entryFilter,
    confidence: confidenceFilter,
    view: view === "standard" ? undefined : view,
  };

  const [themes, alertsResponse, recentAlerts, rotationData] = await Promise.all([
    fetchThemes(),
    fetchAlerts().catch(() => ({ activeCount: 0, alerts: [] })),
    fetchRecentAlerts().catch(() => [] as AlertDto[]),
    fetchRotationScore().catch(() => null),
  ]);

  const historyResults = await Promise.allSettled(
    themes.map(t => fetchThemeHistory(t.id, 30))
  );
  const historyByThemeId: Record<string, ThemeHistoryPoint[]> = {};
  themes.forEach((t, i) => {
    const result = historyResults[i];
    historyByThemeId[t.id] = result.status === "fulfilled" ? result.value : [];
  });

  const themeAlerts = alertsResponse.alerts.filter(a => a.themeId != null && a.status === "ACTIVE");
  const alertsByThemeId: Record<string, number> = {};
  for (const alert of themeAlerts) {
    if (alert.themeId) alertsByThemeId[alert.themeId] = (alertsByThemeId[alert.themeId] ?? 0) + 1;
  }

  const filteredThemes = themes.filter(t => {
    if (signalFilter && t.dominantSignal !== signalFilter) return false;
    if (phaseFilter && t.themePhase !== phaseFilter) return false;
    if (entryFilter && t.entryAction !== entryFilter) return false;
    if (confidenceFilter && t.confidenceLabel !== confidenceFilter) return false;
    return true;
  });

  const buyThemes = themes.filter(t => t.dominantSignal === "BUY").length;
  const watchThemes = themes.filter(t => t.dominantSignal === "WATCH").length;
  const activeThemes = themes.filter(t => t.dominantSignal === "BUY" || t.dominantSignal === "WATCH").length;

  const phaseGroups: { phase: string; count: number; cls: string }[] = [
    { phase: "BREAKOUT", count: themes.filter(t => t.themePhase === "BREAKOUT").length,  cls: "text-emerald-400" },
    { phase: "MOMENTUM", count: themes.filter(t => t.themePhase === "MOMENTUM").length,  cls: "text-cyan-400" },
    { phase: "SETUP",    count: themes.filter(t => t.themePhase === "SETUP").length,     cls: "text-sky-400" },
    { phase: "FADING",   count: themes.filter(t => t.themePhase === "FADING").length,    cls: "text-amber-400" },
    { phase: "WEAK",     count: themes.filter(t => t.themePhase === "WEAK").length,      cls: "text-red-400" },
  ].filter(g => g.count > 0);

  const sortedByScore = [...themes].sort(
    (a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1)
  );

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Investment Themes
          </h1>
          <p className="text-slate-400 text-sm">
            Cross-sector capital flow narratives — each theme aggregates signals across constituent ETFs to surface conviction before the mainstream narrative. Sparklines show 30-day composite trend.
          </p>
          {themes.length > 0 && (
            <div className="flex gap-3 mt-2 flex-wrap">
              {buyThemes > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {buyThemes} BUY
                </span>
              )}
              {watchThemes > 0 && (
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                  {watchThemes} WATCH
                </span>
              )}
              {themeAlerts.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  {themeAlerts.length} alert{themeAlerts.length !== 1 ? "s" : ""}
                </span>
              )}
              {activeThemes === 0 && (
                <span className="text-[11px] font-mono text-slate-500">No active signals</span>
              )}
              {phaseGroups.length > 0 && (
                <span className="text-[11px] font-mono text-slate-400">
                  {phaseGroups.map((g, i) => (
                    <span key={g.phase}>
                      {i > 0 && <span className="text-slate-600"> · </span>}
                      <span className={g.cls}>{g.count} {g.phase}</span>
                    </span>
                  ))}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-600">
                {themes.length} themes · {themes.reduce((a, t) => a + t.constituentCount, 0)} ETFs tracked
              </span>
            </div>
          )}
        </div>

        {themes.length > 0 && <TopOpportunitiesPanel themes={themes} />}
        {themeAlerts.length > 0 && <ThemeAlertFeed alerts={themeAlerts} themes={themes} />}
        {recentAlerts.length > 0 && <ThemeEventsFeed events={recentAlerts} />}
        {themes.length > 0 && <ThemeTippingPoints themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <ThemePlaybook themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <PreBuySetupPanel themes={themes} />}
        {themes.length > 1 && <ThemeRiskMatrixPanel themes={themes} />}
        {rotationData && <CapitalRotationPanel data={rotationData} />}
        {themes.length > 0 && <ThemeEntryAdvisorPanel themes={themes} />}
        {themes.length > 0 && <MomentumDivergencePanel themes={themes} />}
        {themes.length > 0 && <ThemeNarrative themes={themes} />}
        {themes.length > 0 && <ActiveRotationBanner themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <ThemeBuyCountdown themes={themes} />}
        {themes.length > 1 && Object.keys(historyByThemeId).length > 0 && (
          <ThemeScoreZPanel themes={themes} historiesByThemeId={historyByThemeId} />
        )}
        {themes.length > 1 && Object.keys(historyByThemeId).length > 0 && (
          <ThemeSignalStreakPanel themes={themes} historiesByThemeId={historyByThemeId} />
        )}
        {themes.length > 0 && <RotationMomentumStrip themes={themes} />}
        {themes.length > 1 && <ThemeRelativeStrengthPlot themes={themes} />}
        {themes.length > 1 && <ThemePositioningMatrix themes={themes} />}
        {themes.length > 1 && <ThemeRaceChart themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 1 && <ThemeAlertRiskMap themes={themes} />}
        {themes.length > 0 && <ThemeScreener themes={filteredThemes} allThemes={themes} historiesByThemeId={historyByThemeId} alertsByThemeId={alertsByThemeId} sort={screenerSort} allParams={allParams} view={view} />}
        {themes.length > 1 && <ThemeScoreHeatmap themes={themes} historiesByThemeId={historyByThemeId} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedByScore.map(theme => (
            <ThemeCard key={theme.id} theme={theme} history={historyByThemeId[theme.id] ?? []} />
          ))}
        </div>

        {themes.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-12">
            No themes available — run ingestion to populate signals.
          </div>
        )}
      </div>
    </main>
  );
}

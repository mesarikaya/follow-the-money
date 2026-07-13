import { ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import { EntryActionBadge } from "@/components/themes/badges";
import { themeShortLabel } from "@/lib/themes/themeMetrics";

/**
 * The charts that place every theme against the others: relative strength, positioning,
 * risk, and the entry advisor.
 */


export const DualSparkline = ({
  leaderHistory,
  laggerHistory,
}: {
  leaderHistory: ThemeHistoryPoint[];
  laggerHistory: ThemeHistoryPoint[];
}) => {
  if (leaderHistory.length < 2 || laggerHistory.length < 2) return null;
  const W = 96, H = 28;

  const allVals = [...leaderHistory.map(h => h.compositeScore), ...laggerHistory.map(h => h.compositeScore)];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 0.01;

  const toPoints = (hist: ThemeHistoryPoint[]) =>
    hist.map((h, i) => {
      const x = (i / (hist.length - 1)) * W;
      const y = H - ((h.compositeScore - minV) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80 shrink-0">
      <polyline points={toPoints(laggerHistory)} fill="none" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
      <polyline points={toPoints(leaderHistory)} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}


export const SIGNAL_STROKE: Record<string, string> = {
  BUY:    "#34d399",
  WATCH:  "#22d3ee",
  HOLD:   "#64748b",
  REDUCE: "#f87171",
};

export const RISK_ORDINAL: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, EXTREME: 3 };

export const RISK_COLORS: Record<string, string> = {
  LOW:     "#34d399",
  MEDIUM:  "#94a3b8",
  HIGH:    "#fbbf24",
  EXTREME: "#f87171",
};

export const RISK_LABELS = ["LOW", "MEDIUM", "HIGH", "EXTREME"];

export const ThemeRelativeStrengthPlot = ({ themes }: { themes: ThemeSummary[] }) => {
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

export const ThemePositioningMatrix = ({ themes }: { themes: ThemeSummary[] }) => {
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

export const ThemeRiskMatrixPanel = ({ themes }: { themes: ThemeSummary[] }) => {
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

export const ThemeEntryAdvisorPanel = ({ themes }: { themes: ThemeSummary[] }) => {
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

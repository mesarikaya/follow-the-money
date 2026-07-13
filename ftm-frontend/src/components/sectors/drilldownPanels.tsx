import Link from "next/link";
import { SignalHistoryEntry, ThemeSummary } from "@/lib/api";

/** The charts and panels of a sector drilldown: its score trail, its signal components, its themes. */

export function SectorScoreSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 5) return null;
  const W = 160, H = 40, padX = 2, padY = 4;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const toX = (i: number) => padX + (i / (scores.length - 1)) * (W - padX * 2);
  const toY = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);
  const last = scores[scores.length - 1];
  const first = scores[0];
  const isUp = last >= first;
  const color = last >= 0.65 ? "#34d399" : last >= 0.45 ? "#fbbf24" : "#f87171";
  const polyline = scores.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(" ");
  const fillPts = `${toX(0).toFixed(1)},${H} ${polyline} ${toX(scores.length - 1).toFixed(1)},${H}`;
  const trend5 = scores.length >= 5 ? last - scores[scores.length - 5] : 0;
  const trendStr = trend5 > 0.01 ? "↑" : trend5 < -0.01 ? "↓" : "→";
  const trendColor = trend5 > 0.01 ? "text-emerald-400" : trend5 < -0.01 ? "text-red-400" : "text-slate-500";
  void isUp;
  return (
    <div className="flex items-end gap-2" title={`Composite score trend (${scores.length}d) — most recent: ${Math.round(last * 100)}/100`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "80px", height: "20px" }}>
        <polygon points={fillPts} fill={color} opacity="0.12" />
        <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.5" opacity="0.8" />
        <circle cx={toX(scores.length - 1).toFixed(1)} cy={toY(last).toFixed(1)} r="2" fill={color} />
      </svg>
      <span className={`text-xs font-mono ${trendColor}`}>
        {trendStr} {Math.round(last * 100)}
      </span>
    </div>
  );
}

const SIGNAL_SERIES = [
  { key: "COMPOSITE", label: "Composite", stroke: "#22d3ee",   fillOp: 0.08 },
  { key: "RS_60",     label: "RS-60",     stroke: "#4ade80",   fillOp: 0.06 },
  { key: "MACRO_FIT", label: "Macro Fit", stroke: "#a78bfa",   fillOp: 0.06 },
] as const;

export function SignalComponentChart({ entries }: { entries: SignalHistoryEntry[] }) {
  if (!entries || entries.length === 0) return null;

  const byType: Record<string, { date: string; value: number }[]> = {};
  for (const e of entries) {
    if (!byType[e.signalType]) byType[e.signalType] = [];
    byType[e.signalType].push({ date: e.signalDate, value: e.value });
  }

  const hasSeries = SIGNAL_SERIES.some(s => byType[s.key]?.length >= 5);
  if (!hasSeries) return null;

  const allDates = Array.from(
    new Set(entries.map(e => e.signalDate))
  ).sort();
  const dates = allDates.slice(-90);
  if (dates.length < 5) return null;

  const W = 540, H = 120, padL = 38, padR = 12, padT = 10, padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const toX = (i: number, n: number) => padL + (i / (n - 1)) * innerW;

  function normSeries(key: string): { x: number; y: number; v: number }[] | null {
    const raw = byType[key];
    if (!raw || raw.length < 5) return null;
    const dateMap = new Map(raw.map(p => [p.date, p.value]));
    const pts = dates.map(d => dateMap.get(d) ?? null);
    const valid = pts.filter((v): v is number => v !== null);
    if (valid.length < 5) return null;
    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const range = max - min || 1;
    return pts
      .map((v, i) => v !== null ? { x: toX(i, dates.length), y: padT + (1 - (v - min) / range) * innerH, v } : null)
      .filter((p): p is { x: number; y: number; v: number } => p !== null);
  }

  const seriesData = SIGNAL_SERIES.map(s => ({ ...s, pts: normSeries(s.key) }));

  function toPolyline(pts: { x: number; y: number }[]): string {
    return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }
  function toFillPoly(pts: { x: number; y: number }[]): string {
    if (pts.length === 0) return "";
    return `${pts[0].x.toFixed(1)},${(padT + innerH).toFixed(1)} ${toPolyline(pts)} ${pts[pts.length - 1].x.toFixed(1)},${(padT + innerH).toFixed(1)}`;
  }

  const xLabelIdxs = [0, Math.floor(dates.length * 0.25), Math.floor(dates.length * 0.5), Math.floor(dates.length * 0.75), dates.length - 1];

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">Signal Components</div>
        <div className="flex items-center gap-4 text-[10px] text-slate-500">
          {SIGNAL_SERIES.map(s => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-4 h-0.5 rounded" style={{ backgroundColor: s.stroke }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100px" }}>
        {/* Gridlines */}
        {[0.25, 0.5, 0.75].map((f, i) => {
          const y = padT + f * innerH;
          return (
            <line key={i} x1={padL} x2={W - padR} y1={y} y2={y}
              stroke="#334155" strokeWidth="0.5" strokeDasharray="3,4" />
          );
        })}
        {/* Y-axis labels */}
        {["Hi", "Mid", "Lo"].map((l, i) => (
          <text key={l} x={padL - 4} y={padT + [0.1, 0.5, 0.9][i] * innerH + 4}
            fontSize="7" fill="#64748b" textAnchor="end">{l}</text>
        ))}
        {/* Series */}
        {seriesData.map(({ key, stroke, fillOp, pts }) => {
          if (!pts || pts.length < 2) return null;
          return (
            <g key={key}>
              <polygon points={toFillPoly(pts)} fill={stroke} opacity={fillOp} />
              <polyline points={toPolyline(pts)} fill="none" stroke={stroke} strokeWidth="1.5" opacity="0.85" />
              <circle cx={pts[pts.length - 1].x.toFixed(1)} cy={pts[pts.length - 1].y.toFixed(1)} r="2.5" fill={stroke} />
            </g>
          );
        })}
        {/* X-axis date labels */}
        {xLabelIdxs.map(i => {
          const d = dates[i];
          if (!d) return null;
          const x = toX(i, dates.length);
          const label = d.slice(5); // MM-DD
          return (
            <text key={i} x={x} y={H - 4} fontSize="7" fill="#475569" textAnchor="middle">{label}</text>
          );
        })}
        {/* X-axis baseline */}
        <line x1={padL} x2={W - padR} y1={padT + innerH} y2={padT + innerH} stroke="#334155" strokeWidth="0.5" />
      </svg>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Signal history (last {dates.length} trading days) — each series independently normalized to [Lo, Hi] for visual comparison
      </div>
    </div>
  );
}

const SIGNAL_BADGE: Record<string, string> = {
  BUY:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  WATCH:  "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  HOLD:   "bg-slate-700/60 text-slate-400 border-slate-600/40",
  REDUCE: "bg-red-500/15 text-red-400 border-red-500/30",
};

export function ThemeOverlapPanel({
  themes,
  sectorCategoryIds,
}: {
  themes: ThemeSummary[];
  sectorCategoryIds: Set<string>;
}) {
  const overlapping = themes.filter(theme =>
    theme.topConstituents.some(c => sectorCategoryIds.has(c.categoryId))
  );
  if (overlapping.length === 0) return null;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200">Investment Themes</span>
        <span className="text-xs text-slate-500">— cross-sector narratives drawing from this sector</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {overlapping.map(theme => {
          const overlappingConstituents = theme.topConstituents.filter(c => sectorCategoryIds.has(c.categoryId));
          const signalClass = SIGNAL_BADGE[theme.dominantSignal] ?? SIGNAL_BADGE.HOLD;
          const scorePct = theme.compositeScore != null ? Math.round(theme.compositeScore * 100) : null;
          const divPts = theme.divergenceFromParentSectors != null
            ? Math.round(theme.divergenceFromParentSectors * 100)
            : null;
          return (
            <div key={theme.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Link href={`/themes/${theme.id}`} className="text-sm font-semibold text-white hover:text-cyan-300 transition-colors">
                    {theme.name}
                  </Link>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${signalClass}`}>
                    {theme.dominantSignal}
                  </span>
                  {scorePct != null && (
                    <span className="text-[10px] font-mono text-slate-500">{scorePct}/100</span>
                  )}
                  {divPts != null && Math.abs(divPts) >= 2 && (
                    <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${divPts > 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                      {divPts > 0 ? "▲+" : "▼"}{divPts}pt vs sectors
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-1 mb-1.5">{theme.thesis}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-600 uppercase tracking-wider">from this sector:</span>
                  {overlappingConstituents.map(c => (
                    <span key={c.categoryId} className="text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                      {c.etfTicker}
                    </span>
                  ))}
                </div>
              </div>
              <Link href={`/themes/${theme.id}`} className="shrink-0 text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition-colors">
                Details →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

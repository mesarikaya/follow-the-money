import Link from "next/link";
import { fetchTheme, fetchThemeHistory, ThemeConstituent, ThemeHistoryPoint } from "@/lib/api";
import { notFound } from "next/navigation";

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY:    { label: "BUY",    color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { label: "WATCH",  color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40" },
  REDUCE: { label: "REDUCE", color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30" },
};

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return <span className="text-slate-600 text-xs">—</span>;
  const cfg = SIGNAL_CONFIG[signal] ?? SIGNAL_CONFIG.HOLD;
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const pct = Math.round(score * 100);
  const color = score >= 0.65 ? "bg-emerald-500" : score >= 0.50 ? "bg-cyan-500" : score >= 0.35 ? "bg-amber-500" : "bg-red-500";
  const textColor = score >= 0.65 ? "text-emerald-400" : score >= 0.50 ? "text-cyan-400" : score >= 0.35 ? "text-amber-400" : "text-red-400";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums ${textColor}`}>{pct}</span>
    </div>
  );
}

function RsCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const color = value > 0.05 ? "text-emerald-400" : value > 0 ? "text-green-400" : value < -0.05 ? "text-red-400" : "text-amber-400";
  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {value > 0 ? "+" : ""}{(value * 100).toFixed(1)}%
    </span>
  );
}

function FlowCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const isIn = value > 0.3;
  const isOut = value < -0.3;
  const color = isIn ? "text-emerald-400" : isOut ? "text-red-400" : "text-slate-400";
  const arrow = isIn ? "↑" : isOut ? "↓" : "→";
  return (
    <span className={`text-xs font-mono tabular-nums ${color}`}>
      {arrow} {value.toFixed(2)}σ
    </span>
  );
}

function TrendCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const isUp = value > 0.005;
  const isDown = value < -0.005;
  const color = isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-slate-500";
  const arrow = isUp ? "↑" : isDown ? "↓" : "→";
  return <span className={`text-xs font-mono ${color}`}>{arrow} {(value * 100).toFixed(1)}pt</span>;
}

function ConvictionDots({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-700 text-xs">—</span>;
  const filled = Math.round(score / 20);
  return (
    <div className="flex gap-0.5" title={`Conviction: ${score}/100`}>
      {[1,2,3,4,5].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i <= filled ? "bg-blue-400" : "bg-slate-700"}`}
        />
      ))}
    </div>
  );
}

function ConstituentRow({ c, index }: { c: ThemeConstituent; index: number }) {
  return (
    <tr className="border-t border-slate-700/50 hover:bg-slate-800/40 transition-colors">
      <td className="py-2.5 px-3 text-xs text-slate-500 font-mono tabular-nums">{index + 1}</td>
      <td className="py-2.5 px-3">
        <div className="text-xs font-semibold text-slate-200">{c.name}</div>
      </td>
      <td className="py-2.5 px-3">
        <span className="text-[11px] font-mono text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">
          {c.etfTicker}
        </span>
      </td>
      <td className="py-2.5 px-3"><ScoreBar score={c.compositeScore} /></td>
      <td className="py-2.5 px-3"><RsCell value={c.rs60} /></td>
      <td className="py-2.5 px-3"><FlowCell value={c.flow20d} /></td>
      <td className="py-2.5 px-3"><TrendCell value={c.compositeTrend20d} /></td>
      <td className="py-2.5 px-3"><SignalBadge signal={c.tradeSignal} /></td>
      <td className="py-2.5 px-3"><ConvictionDots score={c.convictionScore} /></td>
    </tr>
  );
}

function ThemeHistoryChart({ history }: { history: ThemeHistoryPoint[] }) {
  if (history.length < 3) return null;
  const width = 600, height = 72;
  const padLeft = 28, padRight = 8, padTop = 6, padBottom = 18;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;
  const values = history.map(h => h.compositeScore);
  const minVal = Math.max(0, Math.min(...values) - 0.05);
  const maxVal = Math.min(1, Math.max(...values) + 0.05);
  const yRange = maxVal - minVal;

  const toX = (i: number) => padLeft + (i / (values.length - 1)) * chartWidth;
  const toY = (v: number) => padTop + chartHeight - ((v - minVal) / yRange) * chartHeight;

  const linePath = values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${toX(values.length - 1).toFixed(1)} ${(padTop + chartHeight).toFixed(1)} L ${padLeft} ${(padTop + chartHeight).toFixed(1)} Z`;

  const latest = values[values.length - 1];
  const stroke = latest >= 0.65 ? "#34d399" : latest >= 0.50 ? "#22d3ee" : latest >= 0.35 ? "#fbbf24" : "#f87171";
  const fill = latest >= 0.65 ? "#34d39920" : latest >= 0.50 ? "#22d3ee20" : latest >= 0.35 ? "#fbbf2420" : "#f8717120";

  const buyY = toY(0.65);
  const reduceY = toY(0.35);
  const firstDate = history[0].date;
  const lastDate = history[history.length - 1].date;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">30-day composite trend</span>
        <span className="text-[10px] font-mono text-slate-500">{firstDate} → {lastDate}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        {/* BUY threshold line */}
        <line x1={padLeft} y1={buyY} x2={width - padRight} y2={buyY} stroke="#34d39930" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft - 2} y={buyY + 3} fill="#34d39960" fontSize="7" textAnchor="end" fontFamily="monospace">65</text>
        {/* REDUCE threshold line */}
        <line x1={padLeft} y1={reduceY} x2={width - padRight} y2={reduceY} stroke="#f8717130" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft - 2} y={reduceY + 3} fill="#f8717160" fontSize="7" textAnchor="end" fontFamily="monospace">35</text>
        {/* Area fill */}
        <path d={areaPath} fill={fill} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest value dot */}
        <circle cx={toX(values.length - 1)} cy={toY(latest)} r="3" fill={stroke} />
      </svg>
    </div>
  );
}

function AggMetric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export default async function ThemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let theme;
  try {
    theme = await fetchTheme(id.toUpperCase());
  } catch {
    notFound();
  }

  const history: ThemeHistoryPoint[] = await fetchThemeHistory(id.toUpperCase(), 30).catch(() => []);

  const signal = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-1">
          <Link href="/themes" className="text-slate-500 text-xs hover:text-slate-300 transition-colors">
            ← Themes
          </Link>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 mb-4">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h1 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
                {theme.name}
              </h1>
              <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{theme.thesis}</p>
            </div>
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded ${signal.bg} ${signal.color}`}>
              {signal.label}
            </span>
          </div>

          <div className="flex gap-6 flex-wrap">
            <AggMetric label="Composite">
              {theme.compositeScore != null ? (
                <span className={`text-base font-bold font-mono ${
                  theme.compositeScore >= 0.65 ? "text-emerald-400"
                  : theme.compositeScore >= 0.50 ? "text-cyan-400"
                  : theme.compositeScore >= 0.35 ? "text-amber-400"
                  : "text-red-400"
                }`}>
                  {Math.round(theme.compositeScore * 100)}
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Avg RS-60">
              {theme.rs60 != null ? (
                <span className={`text-base font-bold font-mono ${theme.rs60 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {theme.rs60 > 0 ? "+" : ""}{(theme.rs60 * 100).toFixed(1)}%
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Flow 20d">
              {theme.flow20d != null ? (
                <span className={`text-base font-bold font-mono ${theme.flow20d > 0.3 ? "text-emerald-400" : theme.flow20d < -0.3 ? "text-red-400" : "text-slate-400"}`}>
                  {theme.flow20d > 0 ? "+" : ""}{theme.flow20d.toFixed(2)}σ
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Momentum">
              {theme.compositeTrend20d != null ? (
                <span className={`text-base font-bold font-mono ${theme.compositeTrend20d > 0.005 ? "text-emerald-400" : theme.compositeTrend20d < -0.005 ? "text-red-400" : "text-slate-400"}`}>
                  {theme.compositeTrend20d > 0 ? "↑" : theme.compositeTrend20d < 0 ? "↓" : "→"}
                </span>
              ) : <span className="text-slate-600">—</span>}
            </AggMetric>
            <AggMetric label="Bullish">
              <span className="text-base font-bold font-mono text-slate-300">
                {theme.bullishCount}/{theme.constituentCount}
              </span>
            </AggMetric>
            {theme.divergenceFromParentSectors != null && (
              <AggMetric label="vs Sectors">
                <span
                  className={`text-base font-bold font-mono ${
                    theme.divergenceFromParentSectors > 0.02 ? "text-emerald-400"
                    : theme.divergenceFromParentSectors < -0.02 ? "text-red-400"
                    : "text-slate-400"
                  }`}
                  title="Theme composite minus average parent-sector composite. Positive = theme sub-sectors outpacing their broad sector — early rotation signal."
                >
                  {theme.divergenceFromParentSectors > 0 ? "+" : ""}
                  {Math.round(theme.divergenceFromParentSectors * 100)}pt
                </span>
              </AggMetric>
            )}
          </div>
        </div>

        <ThemeHistoryChart history={history} />

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-700/60">
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">#</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Name</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">ETF</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Score</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">RS-60</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Flow</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Trend</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Signal</th>
                <th className="py-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Conv</th>
              </tr>
            </thead>
            <tbody>
              {theme.constituents.map((c, i) => (
                <ConstituentRow key={c.categoryId} c={c} index={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

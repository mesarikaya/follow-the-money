import Link from "next/link";
import { ThemeSummary } from "@/lib/api";

type Props = {
  themes: ThemeSummary[];
};

const SIGNAL_FILL: Record<string, string> = {
  BUY:    "#34d39990",
  WATCH:  "#22d3ee90",
  HOLD:   "#64748b80",
  REDUCE: "#f8717190",
};

const SIGNAL_STROKE: Record<string, string> = {
  BUY:    "#34d399",
  WATCH:  "#22d3ee",
  HOLD:   "#64748b",
  REDUCE: "#f87171",
};

function themeLabel(theme: ThemeSummary): string {
  const words = theme.name.split(/[\s&-]+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return theme.name.slice(0, 3).toUpperCase();
}

export default function ThemeAlertRiskMap({ themes }: Props) {
  const plottable = themes.filter(
    t => t.compositeScore != null && t.compositeTrend5d != null
  );
  if (plottable.length < 2) return null;

  const W = 420, H = 200;
  const padX = 40, padY = 20;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const maxAlerts = Math.max(1, ...plottable.map(t => t.alertCount30d));
  const trends = plottable.map(t => t.compositeTrend5d!);
  const maxAbsTrend = Math.max(0.01, ...trends.map(Math.abs)) * 1.2;

  const toX = (alerts: number) => padX + (alerts / (maxAlerts * 1.1)) * chartW;
  const toY = (trend: number) => padY + ((maxAbsTrend - trend) / (2 * maxAbsTrend)) * chartH;

  const midX = toX(0);
  const midY = toY(0);
  const midAlerts = maxAlerts / 2;
  const splitX = toX(midAlerts);

  return (
    <div
      data-testid="theme-alert-risk-map"
      className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">
          Alert Risk Map · alert activity vs 5-day momentum
        </span>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-600">
          <span>← quiet</span>
          <span>noisy →</span>
        </div>
      </div>
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="overflow-visible"
      >
        {/* Quadrant fills */}
        <rect x={padX} y={padY} width={splitX - padX} height={midY - padY} fill="#34d39906" />
        <rect x={splitX} y={padY} width={W - padX - splitX} height={midY - padY} fill="#22d3ee04" />
        <rect x={padX} y={midY} width={splitX - padX} height={H - padY - midY} fill="#64748b04" />
        <rect x={splitX} y={midY} width={W - padX - splitX} height={H - padY - midY} fill="#f8717105" />

        {/* Quadrant labels */}
        <text x={padX + 4} y={padY + 10} fill="#34d39930" fontSize="7" fontFamily="monospace">Rising Quietly</text>
        <text x={W - padX - 3} y={padY + 10} fill="#22d3ee28" fontSize="7" textAnchor="end" fontFamily="monospace">Alert-Confirmed Rise</text>
        <text x={padX + 4} y={H - padY - 4} fill="#64748b40" fontSize="7" fontFamily="monospace">Fading Quietly</text>
        <text x={W - padX - 3} y={H - padY - 4} fill="#f8717130" fontSize="7" textAnchor="end" fontFamily="monospace">Alarm Zone</text>

        {/* Zero trend axis */}
        <line x1={padX} y1={midY} x2={W - padX} y2={midY} stroke="#334155" strokeWidth="1" />
        {/* Left axis */}
        <line x1={padX} y1={padY} x2={padX} y2={H - padY} stroke="#1e293b" strokeWidth="1" />
        {/* Midpoint divider */}
        <line x1={splitX} y1={padY} x2={splitX} y2={H - padY} stroke="#334155" strokeWidth="0.5" strokeDasharray="3 3" />

        {/* Axis labels */}
        <text x={padX} y={midY - 4} fill="#475569" fontSize="7" fontFamily="monospace">↑ Rising</text>
        <text x={padX} y={H - padY + 10} fill="#475569" fontSize="7" fontFamily="monospace">↓ Fading</text>
        <text x={W / 2} y={H - 4} fill="#475569" fontSize="7" textAnchor="middle" fontFamily="monospace">Alert Activity (30d)</text>

        {/* Dots */}
        {plottable.map(t => {
          const cx = toX(t.alertCount30d);
          const cy = toY(t.compositeTrend5d!);
          const score = t.compositeScore ?? 0.5;
          const r = 4 + score * 6;
          const fill = SIGNAL_FILL[t.dominantSignal] ?? SIGNAL_FILL.HOLD;
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? SIGNAL_STROKE.HOLD;
          const label = themeLabel(t);
          const labelRight = cx > W * 0.70;
          const labelAbove = cy < padY + 20;
          return (
            <g key={t.id}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth="1"
                strokeOpacity="0.8"
              />
              <text
                x={labelRight ? cx - r - 2 : cx + r + 2}
                y={labelAbove ? cy + 10 : cy + 3}
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

        {/* Y-axis tick labels */}
        <text x={padX - 3} y={padY + 5} fill="#475569" fontSize="6" textAnchor="end" fontFamily="monospace">
          +{Math.round(maxAbsTrend * 100)}pt
        </text>
        <text x={padX - 3} y={H - padY + 1} fill="#475569" fontSize="6" textAnchor="end" fontFamily="monospace">
          -{Math.round(maxAbsTrend * 100)}pt
        </text>
      </svg>

      <div className="flex items-center justify-end gap-4 mt-1 text-[9px] font-mono text-slate-600">
        {(["BUY", "WATCH", "HOLD", "REDUCE"] as const).map(s => (
          <span key={s} className="flex items-center gap-1">
            <span
              style={{ background: SIGNAL_FILL[s], border: `1px solid ${SIGNAL_STROKE[s]}` }}
              className="inline-block w-2 h-2 rounded-full"
            />
            {s}
          </span>
        ))}
        <span className="text-slate-700">· dot size = score</span>
      </div>
    </div>
  );
}

import { CategorySummary } from "@/lib/api";

/** The two whole-market views on the sectors hub: the rotation graph and the confluence matrix. */

const MONO = { fontFamily: "var(--font-jetbrains-mono)" };

const QUADRANT_DOT_COLORS: Record<string, string> = {
  "4": "#4ade80",
  "3": "#22d3ee",
  "2": "#fb923c",
  "1": "#94a3b8",
};

export const RrgScatterChart = ({ sectors }: { sectors: CategorySummary[] }) => {
  const points = sectors.filter(s => s.rs60 != null && s.rs20 != null);
  if (points.length < 4) return null;

  const width = 520, height = 340, padLeft = 44, padRight = 20, padTop = 22, padBottom = 32;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const relativeStrengths = points.map(p => p.rs60! * 100);
  const momenta = points.map(p => (p.rs20! - p.rs60!) * 100);
  const xLimit = Math.max(8, Math.max(...relativeStrengths.map(Math.abs)) + 1);
  const yLimit = Math.max(4, Math.max(...momenta.map(Math.abs)) + 0.5);

  const toX = (value: number) => padLeft + ((value + xLimit) / (2 * xLimit)) * innerWidth;
  const toY = (value: number) => padTop + (1 - (value + yLimit) / (2 * yLimit)) * innerHeight;
  const zeroX = toX(0);
  const zeroY = toY(0);

  const quadrants = [
    { x: zeroX,   y: padTop, width: width - padRight - zeroX, height: zeroY - padTop,           fill: "#052e16", label: "↗ Leading",   labelX: width - padRight - 4, labelY: padTop + 11,        anchor: "end",   color: "#4ade80" },
    { x: padLeft, y: padTop, width: zeroX - padLeft,          height: zeroY - padTop,           fill: "#042f4f", label: "↖ Improving", labelX: padLeft + 4,          labelY: padTop + 11,        anchor: "start", color: "#22d3ee" },
    { x: padLeft, y: zeroY,  width: zeroX - padLeft,          height: height - padBottom - zeroY, fill: "#1c1917", label: "↙ Lagging",  labelX: padLeft + 4,          labelY: height - padBottom - 5, anchor: "start", color: "#94a3b8" },
    { x: zeroX,   y: zeroY,  width: width - padRight - zeroX, height: height - padBottom - zeroY, fill: "#2d1b00", label: "↘ Weakening", labelX: width - padRight - 4, labelY: height - padBottom - 5, anchor: "end", color: "#fb923c" },
  ];

  const xTicks = [-8, -4, 0, 4, 8].filter(v => v > -xLimit && v < xLimit);
  const yTicks = [-3, -1.5, 0, 1.5, 3].filter(v => v > -yLimit && v < yLimit);

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">Relative Rotation Graph</div>
        <div className="text-[10px] text-slate-500">X = RS-60 vs SPY · Y = RS momentum (RS-20 minus RS-60)</div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: "340px", height: `${height}px` }}>
          {quadrants.map(quadrant => (
            <g key={quadrant.label}>
              <rect x={quadrant.x} y={quadrant.y} width={quadrant.width} height={quadrant.height} fill={quadrant.fill} opacity="0.75" />
              <text
                x={quadrant.labelX}
                y={quadrant.labelY}
                fontSize="9"
                fill={quadrant.color}
                textAnchor={quadrant.anchor as "start" | "end"}
                opacity="0.65"
                style={{ fontFamily: "var(--font-rajdhani)", fontWeight: 600 }}
              >
                {quadrant.label}
              </text>
            </g>
          ))}

          {xTicks.map(tick => (
            <line key={tick} x1={toX(tick)} x2={toX(tick)} y1={padTop} y2={height - padBottom} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,4" />
          ))}
          {yTicks.map(tick => (
            <line key={tick} x1={padLeft} x2={width - padRight} y1={toY(tick)} y2={toY(tick)} stroke="#334155" strokeWidth="0.5" strokeDasharray="3,4" />
          ))}

          <line x1={padLeft} x2={width - padRight} y1={zeroY} y2={zeroY} stroke="#475569" strokeWidth="1" />
          <line x1={zeroX} x2={zeroX} y1={padTop} y2={height - padBottom} stroke="#475569" strokeWidth="1" />

          {xTicks.map(tick => (
            <text key={tick} x={toX(tick)} y={height - padBottom + 10} fontSize="7.5" fill="#475569" textAnchor="middle">
              {tick > 0 ? `+${tick}%` : `${tick}%`}
            </text>
          ))}
          {yTicks.filter(tick => tick !== 0).map(tick => (
            <text key={tick} x={padLeft - 4} y={toY(tick) + 3} fontSize="7" fill="#475569" textAnchor="end">
              {tick > 0 ? `+${tick.toFixed(1)}` : tick.toFixed(1)}
            </text>
          ))}
          <text x={padLeft - 4} y={padTop + 4} fontSize="7" fill="#475569" textAnchor="end">↑mom</text>

          {points.map(sector => {
            const x = toX(sector.rs60! * 100);
            const y = toY((sector.rs20! - sector.rs60!) * 100);
            const color = QUADRANT_DOT_COLORS[sector.rrgQuadrant ?? ""] ?? "#64748b";
            return (
              <g key={sector.id}>
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="8" fill={color} opacity="0.18" />
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r="5" fill={color} opacity="0.9" />
                <text
                  x={x.toFixed(1)}
                  y={(y - 9).toFixed(1)}
                  fontSize="8.5"
                  fill="#e2e8f0"
                  textAnchor="middle"
                  fontWeight="700"
                  style={MONO}
                >
                  {sector.etfTicker}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Leading = outperforming + momentum building · Rotation: clockwise through Leading→Weakening→Lagging→Improving
      </div>
    </div>
  );
};

type ConfluenceSignal = {
  key: string;
  label: string;
  read: (sector: CategorySummary) => number | null;
  isBullish: (value: number) => boolean;
  format: (value: number) => string;
};

const CONFLUENCE_SIGNALS: ConfluenceSignal[] = [
  {
    key: "rrg",
    label: "RRG",
    read: s => (s.rrgQuadrant != null ? Number(s.rrgQuadrant) : null),
    isBullish: v => v >= 3,
    format: v => (v === 4 ? "↗L" : v === 3 ? "↖I" : v === 2 ? "↘W" : "↙Lg"),
  },
  {
    key: "score",
    label: "Score",
    read: s => s.compositeScore,
    isBullish: v => v >= 0.5,
    format: v => `${Math.round(v * 100)}`,
  },
  {
    key: "pct",
    label: "Pctile",
    read: s => s.scorePercentile252d,
    isBullish: v => v >= 0.6,
    format: v => `P${Math.round(v * 100)}`,
  },
  {
    key: "rs60",
    label: "RS-60",
    read: s => s.rs60,
    isBullish: v => v > 0,
    format: v => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(0)}%`,
  },
  {
    key: "flow",
    label: "Flow",
    read: s => s.flow20d,
    isBullish: v => v > 0.3,
    format: v => `${v >= 0 ? "+" : ""}${v.toFixed(1)}σ`,
  },
  {
    key: "macro",
    label: "Macro",
    read: s => s.macroFit,
    isBullish: v => v >= 0.55,
    format: v => `${Math.round(v * 100)}%`,
  },
];

const countBullishSignals = (sector: CategorySummary): number =>
  CONFLUENCE_SIGNALS.filter(signal => {
    const value = signal.read(sector);
    return value != null && signal.isBullish(value);
  }).length;

export const SignalConfluenceMatrix = ({ sectors }: { sectors: CategorySummary[] }) => {
  const rows = sectors
    .filter(sector => sector.compositeScore != null)
    .sort((a, b) => countBullishSignals(b) - countBullishSignals(a));
  if (rows.length === 0) return null;

  return (
    <div className="mt-6 bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h2
          className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest"
          style={{ fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" }}
        >
          Signal Confluence Matrix
        </h2>
        <div className="text-[9px] text-slate-600">sorted by bullish signal count ↓</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]" style={{ minWidth: "480px" }}>
          <thead>
            <tr>
              <th className="text-left text-slate-500 font-normal pb-1.5 pr-3 w-20">Sector</th>
              {CONFLUENCE_SIGNALS.map(signal => (
                <th key={signal.key} className="text-center text-slate-500 font-normal pb-1.5 px-1 min-w-[52px]" style={MONO}>
                  {signal.label}
                </th>
              ))}
              <th className="text-center text-slate-500 font-normal pb-1.5 px-1">✓</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(sector => {
              const bullishCount = countBullishSignals(sector);
              return (
                <tr key={sector.id} className="border-t border-slate-700/30">
                  <td className="py-1 pr-3">
                    <span className="text-[10px] text-cyan-400" style={MONO}>{sector.etfTicker}</span>
                  </td>
                  {CONFLUENCE_SIGNALS.map(signal => {
                    const value = signal.read(sector);
                    if (value == null) {
                      return (
                        <td key={signal.key} className="text-center py-1 px-1">
                          <span className="text-slate-700">—</span>
                        </td>
                      );
                    }
                    const isBullish = signal.isBullish(value);
                    return (
                      <td key={signal.key} className="text-center py-1 px-1">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[9px] tabular-nums font-mono ${
                            isBullish ? "bg-emerald-900/30 text-emerald-300" : "bg-red-900/20 text-red-400"
                          }`}
                          title={`${sector.etfTicker} ${signal.label}: ${signal.format(value)} — ${isBullish ? "bullish" : "bearish"}`}
                        >
                          {signal.format(value)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-center py-1 px-1">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        bullishCount >= 5 ? "text-emerald-400" : bullishCount >= 3 ? "text-amber-400" : "text-slate-500"
                      }`}
                      style={MONO}
                    >
                      {bullishCount}/{CONFLUENCE_SIGNALS.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-[9px] text-slate-600 mt-2">
        Green = bullish threshold met · RRG Leading/Improving · Score≥50 · P60+ percentile · RS-60{">"}0 · Flow{">"}+0.3σ · MacroFit≥55%
      </div>
    </div>
  );
};

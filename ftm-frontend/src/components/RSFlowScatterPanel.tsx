import type { CategorySummary } from "@/lib/api";

const EQUITY_SECTOR_IDS = new Set([
  "TECH", "FINL", "HLTH", "DISR", "INDU", "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM",
]);

function quadrantLabel(rs60: number, flow20d: number): string {
  if (rs60 >= 0 && flow20d >= 0) return "Confirmed";
  if (rs60 < 0 && flow20d >= 0) return "Accumulating";
  if (rs60 >= 0 && flow20d < 0) return "Distributing";
  return "Avoid";
}

function dotColor(rs60: number, flow20d: number): string {
  if (rs60 >= 0 && flow20d >= 0) return "#4ade80";
  if (rs60 < 0 && flow20d >= 0) return "#22d3ee";
  if (rs60 >= 0 && flow20d < 0) return "#fb923c";
  return "#64748b";
}

export default function RSFlowScatterPanel({ categories }: { categories: CategorySummary[] }) {
  const sectors = categories.filter(
    (c) => EQUITY_SECTOR_IDS.has(c.id) && c.rs60 !== null && c.flow20d !== null
  );

  if (sectors.length < 2) return null;

  const W = 500;
  const H = 300;
  const padX = 52;
  const padY = 32;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const cx = padX + innerW / 2;
  const cy = padY + innerH / 2;

  const rsValues   = sectors.map((s) => s.rs60 ?? 0);
  const flowValues = sectors.map((s) => s.flow20d ?? 0);
  const rsMax   = Math.max(...rsValues.map(Math.abs), 0.03);
  const flowMax = Math.max(...flowValues.map(Math.abs), 0.3);

  const toX = (rs: number)   => cx + (rs   / rsMax)   * (innerW / 2) * 0.9;
  const toY = (flow: number) => cy - (flow / flowMax)  * (innerH / 2) * 0.9;

  const confirmedCount   = sectors.filter(s => (s.rs60 ?? 0) >= 0 && (s.flow20d ?? 0) >= 0).length;
  const accumulatingCount = sectors.filter(s => (s.rs60 ?? 0) < 0 && (s.flow20d ?? 0) >= 0).length;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">RS vs Flow Positioning</h2>
          <p className="text-[10px] text-slate-600 mt-0.5">
            X = RS-60 relative to SPY · Y = 20d flow z-score
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {confirmedCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-700/30">
              {confirmedCount} confirmed (RS+ flow+)
            </span>
          )}
          {accumulatingCount > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-700/30">
              {accumulatingCount} accumulating (RS− flow+)
            </span>
          )}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {/* Quadrant fills */}
        <rect x={padX} y={padY} width={innerW / 2} height={innerH / 2} fill="#164e63" opacity="0.45" />
        <rect x={cx}   y={padY} width={innerW / 2} height={innerH / 2} fill="#14532d" opacity="0.45" />
        <rect x={padX} y={cy}   width={innerW / 2} height={innerH / 2} fill="#1c1917" opacity="0.45" />
        <rect x={cx}   y={cy}   width={innerW / 2} height={innerH / 2} fill="#431407" opacity="0.45" />

        {/* Quadrant labels */}
        <text x={padX + 5} y={padY + 13} fontSize="8.5" fill="#67e8f9" opacity="0.65" fontWeight="600">↑ Accumulating</text>
        <text x={cx + 5}   y={padY + 13} fontSize="8.5" fill="#86efac" opacity="0.65" fontWeight="600">↗ Confirmed</text>
        <text x={padX + 5} y={H - padY - 4} fontSize="8.5" fill="#78716c" opacity="0.65" fontWeight="600">↙ Avoid</text>
        <text x={cx + 5}   y={H - padY - 4} fontSize="8.5" fill="#fb923c" opacity="0.65" fontWeight="600">↘ Distributing</text>

        {/* Center axes */}
        <line x1={padX} y1={cy}   x2={W - padX} y2={cy}   stroke="#334155" strokeWidth="1" />
        <line x1={cx}   y1={padY} x2={cx}        y2={H - padY} stroke="#334155" strokeWidth="1" />

        {/* Axis labels */}
        <text x={W - padX + 3} y={cy + 4} fontSize="8" fill="#475569" textAnchor="start">RS+</text>
        <text x={padX - 3}     y={cy + 4} fontSize="8" fill="#475569" textAnchor="end">RS−</text>
        <text x={cx} y={padY - 4} fontSize="8" fill="#475569" textAnchor="middle">Flow+</text>
        <text x={cx} y={H - padY + 12} fontSize="8" fill="#475569" textAnchor="middle">Flow−</text>

        {/* Ticks */}
        {[0.25, 0.5, 0.75, -0.25, -0.5, -0.75].map(f => {
          const xP = cx + f * (innerW / 2) * 0.9;
          const yP = cy - f * (innerH / 2) * 0.9;
          return (
            <g key={f}>
              <line x1={xP} y1={cy - 3} x2={xP} y2={cy + 3} stroke="#334155" strokeWidth="0.5" />
              <line x1={cx - 3} y1={yP} x2={cx + 3} y2={yP} stroke="#334155" strokeWidth="0.5" />
            </g>
          );
        })}

        {/* Sector dots + labels */}
        {sectors.map((s) => {
          const x = toX(s.rs60 ?? 0);
          const y = toY(s.flow20d ?? 0);
          const color = dotColor(s.rs60 ?? 0, s.flow20d ?? 0);
          const labelX = x > cx + innerW / 4 ? x - 3 : x + 3;
          const anchor = x > cx + innerW / 4 ? "end" : "start";
          const labelY = y < cy - innerH / 4 ? y + 11 : y - 4;
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r="6" fill={color} opacity="0.18" />
              <circle cx={x} cy={y} r="4.5" fill={color} opacity="0.9" />
              <text
                x={labelX} y={labelY}
                fontSize="8.5"
                fill="#e2e8f0"
                textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono)"
                fontWeight="700"
              >
                {s.etfTicker}
              </text>
              <text
                x={labelX}
                y={labelY + 9}
                fontSize="7"
                fill="#94a3b8"
                textAnchor={anchor}
                fontFamily="var(--font-jetbrains-mono)"
              >
                {quadrantLabel(s.rs60 ?? 0, s.flow20d ?? 0)}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="text-[9px] text-slate-700 text-center mt-1">
        Confirmed = strong RS + institutional inflows · Accumulating = weak RS but buying emerging · Distributing = RS strong but money leaving
      </div>
    </div>
  );
}

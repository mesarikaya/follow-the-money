import type { CategorySummary } from "@/lib/api";

const EQUITY_SECTOR_IDS = new Set([
  "TECH", "FINL", "HLTH", "DISR", "INDU", "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM",
]);

const QUADRANT_META = {
  tl: { label: "↖ Improving", note: "Rising momentum, low RS",   fill: "#164e63", textColor: "#67e8f9" },
  tr: { label: "↗ Leading",   note: "High RS, rising momentum",  fill: "#14532d", textColor: "#86efac" },
  bl: { label: "↙ Lagging",   note: "Low RS, falling momentum",  fill: "#1c1917", textColor: "#78716c" },
  br: { label: "↘ Weakening", note: "High RS, falling momentum", fill: "#431407", textColor: "#fb923c" },
};

export default function SectorRotationWheel({ categories }: { categories: CategorySummary[] }) {
  const sectors = categories.filter(
    (c) =>
      EQUITY_SECTOR_IDS.has(c.id) &&
      c.rs60 !== null &&
      c.compositeTrend5d !== null
  );

  if (sectors.length === 0) return null;

  const W = 520;
  const H = 320;
  const padX = 56;
  const padY = 36;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const cx = padX + innerW / 2;
  const cy = padY + innerH / 2;

  // Normalize axes
  const rsValues = sectors.map((s) => s.rs60 ?? 0);
  const trendValues = sectors.map((s) => s.compositeTrend5d ?? 0);
  const rsMax = Math.max(...rsValues.map(Math.abs), 0.05);
  const trendMax = Math.max(...trendValues.map(Math.abs), 0.02);

  const toX = (rs: number) => cx + (rs / rsMax) * (innerW / 2) * 0.88;
  const toY = (trend: number) => cy - (trend / trendMax) * (innerH / 2) * 0.88;

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Sector Rotation Wheel</h2>
          <p className="text-[10px] text-slate-600 mt-0.5">
            RS-60 (x) vs 5d score trend (y) — Leading = top-right, Improving = top-left
          </p>
        </div>
        <div className="flex items-center gap-3 text-[9px] text-slate-600 shrink-0">
          {Object.entries(QUADRANT_META).map(([k, q]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: q.fill, border: `1px solid ${q.textColor}40` }} />
              <span style={{ color: q.textColor }}>{q.label.split(" ")[0]}</span>
            </span>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {/* Quadrant fills */}
        <rect x={padX} y={padY} width={innerW / 2} height={innerH / 2} fill={QUADRANT_META.tl.fill} opacity="0.5" rx="2" />
        <rect x={cx} y={padY} width={innerW / 2} height={innerH / 2} fill={QUADRANT_META.tr.fill} opacity="0.5" rx="2" />
        <rect x={padX} y={cy} width={innerW / 2} height={innerH / 2} fill={QUADRANT_META.bl.fill} opacity="0.5" rx="2" />
        <rect x={cx} y={cy} width={innerW / 2} height={innerH / 2} fill={QUADRANT_META.br.fill} opacity="0.5" rx="2" />

        {/* Quadrant labels */}
        {Object.entries({
          tl: { x: padX + 6, y: padY + 14 },
          tr: { x: cx + 6,   y: padY + 14 },
          bl: { x: padX + 6, y: H - padY - 5 },
          br: { x: cx + 6,   y: H - padY - 5 },
        }).map(([k, pos]) => {
          const q = QUADRANT_META[k as keyof typeof QUADRANT_META];
          return (
            <text key={k} x={pos.x} y={pos.y} fontSize="9" fill={q.textColor} opacity="0.7" fontWeight="600">
              {q.label}
            </text>
          );
        })}

        {/* Center axes */}
        <line x1={padX} y1={cy} x2={W - padX} y2={cy} stroke="#334155" strokeWidth="1" />
        <line x1={cx} y1={padY} x2={cx} y2={H - padY} stroke="#334155" strokeWidth="1" />

        {/* Axis labels */}
        <text x={W - padX + 4} y={cy + 4} fontSize="8" fill="#475569" textAnchor="start">RS+</text>
        <text x={padX - 4}     y={cy + 4} fontSize="8" fill="#475569" textAnchor="end">RS−</text>
        <text x={cx}           y={padY - 4} fontSize="8" fill="#475569" textAnchor="middle">Score↑</text>
        <text x={cx}           y={H - padY + 12} fontSize="8" fill="#475569" textAnchor="middle">Score↓</text>

        {/* Sector dots + labels */}
        {sectors.map((s) => {
          const x = toX(s.rs60 ?? 0);
          const y = toY(s.compositeTrend5d ?? 0);
          const isLeading  = (s.rs60 ?? 0) >= 0 && (s.compositeTrend5d ?? 0) >= 0;
          const isImproving = (s.rs60 ?? 0) < 0 && (s.compositeTrend5d ?? 0) >= 0;
          const isWeakening = (s.rs60 ?? 0) >= 0 && (s.compositeTrend5d ?? 0) < 0;
          const dotColor =
            isLeading  ? "#4ade80" :
            isImproving ? "#22d3ee" :
            isWeakening ? "#fb923c" :
            "#64748b";
          const score = s.compositeScore != null ? Math.round(s.compositeScore * 100) : null;

          // Keep text inside bounds
          const labelX = x > cx + innerW / 4 ? x - 2 : x + 2;
          const labelAnchor = x > cx + innerW / 4 ? "end" : "start";
          const labelY = y < cy - innerH / 4 ? y + 10 : y - 4;

          return (
            <g key={s.id}>
              <circle
                cx={x} cy={y} r="5"
                fill={dotColor}
                opacity="0.85"
                {...{ title: `${s.name} — RS60: ${((s.rs60 ?? 0) * 100).toFixed(1)}%, Trend5d: ${((s.compositeTrend5d ?? 0) * 100).toFixed(1)}pts` }}
              />
              <text
                x={labelX} y={labelY}
                fontSize="8" fill="#e2e8f0" textAnchor={labelAnchor}
                fontFamily="var(--font-jetbrains-mono)"
              >
                {s.etfTicker}
              </text>
              {score !== null && (
                <text
                  x={labelX} y={labelY + 9}
                  fontSize="7" fill={score >= 65 ? "#4ade80" : score >= 45 ? "#fbbf24" : "#f87171"}
                  textAnchor={labelAnchor}
                  fontFamily="var(--font-jetbrains-mono)"
                >
                  {score}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="text-[9px] text-slate-700 text-center mt-1">
        Dot color: green=Leading · cyan=Improving · orange=Weakening · gray=Lagging · number = composite score
      </div>
    </div>
  );
}

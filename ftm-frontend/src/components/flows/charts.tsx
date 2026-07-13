import { CategorySummary, SeasonalReturn } from "@/lib/api";
import { returnToColor, scoreToColor } from "@/lib/flows/flowMetrics";

/** The SVG charts on the capital-flows page: positioning map and the two heatmaps. */

const MONO = { fontFamily: "var(--font-jetbrains-mono)" };
const SECTION_HEADING = { fontFamily: "var(--font-rajdhani)", letterSpacing: "0.1em" };

export const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SIGNAL_DOT: Record<string, { fill: string; stroke: string }> = {
  BUY:    { fill: "#16a34a", stroke: "#4ade80" },
  WATCH:  { fill: "#0e7490", stroke: "#22d3ee" },
  HOLD:   { fill: "#374151", stroke: "#6b7280" },
  REDUCE: { fill: "#991b1b", stroke: "#f87171" },
};

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-slate-300 text-[10px] font-semibold uppercase tracking-widest" style={SECTION_HEADING}>
    {children}
  </h2>
);

export const RsScoreScatter = ({ categories }: { categories: CategorySummary[] }) => {
  const points = categories.filter(c => c.rs60 != null && c.compositeScore != null);
  if (points.length < 3) return null;

  const width = 480, height = 280, padLeft = 40, padRight = 16, padTop = 24, padBottom = 32;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;

  const relativeStrengths = points.map(p => p.rs60! * 100);
  const xMin = Math.min(-8, Math.min(...relativeStrengths) - 1);
  const xMax = Math.max(8, Math.max(...relativeStrengths) + 1);

  const toX = (value: number) => padLeft + ((value - xMin) / (xMax - xMin)) * innerWidth;
  const toY = (value: number) => padTop + (1 - value / 100) * innerHeight;
  const zeroX = toX(0);
  const midY = toY(50);

  const quadrantLabels = [
    { x: (zeroX + padLeft + innerWidth) / 2, y: (padTop + midY) / 2,                text: "High RS · High Score", color: "#22c55e", opacity: 0.5 },
    { x: (padLeft + zeroX) / 2,              y: (padTop + midY) / 2,                text: "Low RS · High Score",  color: "#fbbf24", opacity: 0.4 },
    { x: (zeroX + padLeft + innerWidth) / 2, y: (midY + padTop + innerHeight) / 2,  text: "High RS · Low Score",  color: "#22d3ee", opacity: 0.4 },
    { x: (padLeft + zeroX) / 2,              y: (midY + padTop + innerHeight) / 2,  text: "Low RS · Low Score",   color: "#f87171", opacity: 0.35 },
  ];

  return (
    <div
      className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4"
      title="RS-60 vs Composite Score scatter. X=relative strength vs SPY (60d), Y=composite signal score (0-100). Top-right = strongest buy candidates."
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-slate-200">RS-60 vs Score — Positioning Map</div>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          {(["BUY", "WATCH", "HOLD", "REDUCE"] as const).map(signal => (
            <span key={signal} className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: SIGNAL_DOT[signal].stroke }} />
              {signal}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: "360px" }}>
          <rect x={zeroX}   y={padTop} width={padLeft + innerWidth - zeroX} height={midY - padTop} fill="#16a34a" opacity="0.04" />
          <rect x={padLeft} y={padTop} width={zeroX - padLeft}              height={midY - padTop} fill="#fbbf24" opacity="0.03" />
          <rect x={zeroX}   y={midY}   width={padLeft + innerWidth - zeroX} height={padTop + innerHeight - midY} fill="#06b6d4" opacity="0.03" />
          <rect x={padLeft} y={midY}   width={zeroX - padLeft}              height={padTop + innerHeight - midY} fill="#ef4444" opacity="0.03" />

          {quadrantLabels.map(label => (
            <text key={label.text} x={label.x.toFixed(1)} y={label.y.toFixed(1)} fill={label.color} fontSize="8.5" textAnchor="middle" opacity={label.opacity}>
              {label.text}
            </text>
          ))}

          <line x1={zeroX.toFixed(1)} y1={padTop} x2={zeroX.toFixed(1)} y2={padTop + innerHeight} stroke="#334155" strokeWidth="0.8" />
          <line x1={padLeft} y1={midY.toFixed(1)} x2={padLeft + innerWidth} y2={midY.toFixed(1)} stroke="#334155" strokeWidth="0.8" />

          {[-6, -4, -2, 0, 2, 4, 6].map(tick => {
            const x = toX(tick);
            if (x < padLeft || x > padLeft + innerWidth) return null;
            return (
              <g key={tick}>
                <line x1={x.toFixed(1)} y1={(padTop + innerHeight).toFixed(1)} x2={x.toFixed(1)} y2={(padTop + innerHeight + 3).toFixed(1)} stroke="#475569" strokeWidth="0.5" />
                <text x={x.toFixed(1)} y={height - 6} fill="#64748b" fontSize="8" textAnchor="middle">{tick > 0 ? `+${tick}` : tick}%</text>
              </g>
            );
          })}

          {[0, 25, 50, 75, 100].map(tick => {
            const y = toY(tick);
            return (
              <g key={tick}>
                <line x1={(padLeft - 3).toFixed(1)} y1={y.toFixed(1)} x2={padLeft.toFixed(1)} y2={y.toFixed(1)} stroke="#475569" strokeWidth="0.5" />
                <text x={(padLeft - 5).toFixed(1)} y={(y + 3).toFixed(1)} fill="#64748b" fontSize="8" textAnchor="end">{tick}</text>
              </g>
            );
          })}

          <text x={(padLeft + innerWidth / 2 + padLeft / 2).toFixed(1)} y={height - 1} fill="#475569" fontSize="8" textAnchor="middle">RS-60 vs SPY →</text>
          <text x="8" y={(padTop + innerHeight / 2).toFixed(1)} fill="#475569" fontSize="8" textAnchor="middle" transform={`rotate(-90,8,${(padTop + innerHeight / 2).toFixed(1)})`}>Score</text>

          {points.map(category => {
            const x = toX(category.rs60! * 100);
            const y = toY(category.compositeScore! * 100);
            if (x < padLeft || x > padLeft + innerWidth || y < padTop || y > padTop + innerHeight) return null;
            const signal = category.tradeSignal ?? "HOLD";
            const dot = SIGNAL_DOT[signal] ?? SIGNAL_DOT.HOLD;
            const radius = signal === "BUY" || signal === "REDUCE" ? 5 : 4;
            return (
              <g key={category.id}>
                <circle cx={x.toFixed(1)} cy={y.toFixed(1)} r={radius} fill={dot.fill} stroke={dot.stroke} strokeWidth="0.8" opacity="0.85" />
                <text x={x.toFixed(1)} y={(y - radius - 2).toFixed(1)} fill="#e2e8f0" fontSize="7.5" textAnchor="middle" opacity="0.85">
                  {category.etfTicker}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Top-right = strongest buy zone (high RS + high score) · Bottom-left = avoid · Size = signal strength
      </div>
    </div>
  );
};

export type ScoreHistoryMap = Record<string, number[]>;

const HEATMAP_DAYS = 30;

export const ScoreHistoryHeatmap = ({
  categories,
  scoreHistory,
}: {
  categories: CategorySummary[];
  scoreHistory: ScoreHistoryMap;
}) => {
  const latestScore = (categoryId: string) => scoreHistory[categoryId]?.slice(-1)[0] ?? 0;
  const rows = categories
    .filter(c => scoreHistory[c.id]?.length >= 5)
    .sort((a, b) => latestScore(b.id) - latestScore(a.id));

  if (rows.length === 0) return null;

  const cellWidth = 12, cellHeight = 14, gap = 1;
  const labelWidth = 44, scoreWidth = 32, padLeft = 8, padRight = 8, padTop = 24, padBottom = 20;
  const innerWidth = HEATMAP_DAYS * (cellWidth + gap) - gap;
  const width = padLeft + labelWidth + 4 + innerWidth + 4 + scoreWidth + padRight;
  const height = padTop + rows.length * (cellHeight + gap) - gap + padBottom;

  const columnX = (column: number) => padLeft + labelWidth + 4 + column * (cellWidth + gap);
  const rowY = (row: number) => padTop + row * (cellHeight + gap);

  const ticks = [
    { column: 0, label: "-30d" },
    { column: 6, label: "-23d" },
    { column: 13, label: "-16d" },
    { column: 20, label: "-9d" },
    { column: HEATMAP_DAYS - 1, label: "now" },
  ];

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <SectionHeading>Score Momentum — 30-Day Heatmap</SectionHeading>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />Strong
          <span className="inline-block w-3 h-3 rounded-sm bg-yellow-600" />Mid
          <span className="inline-block w-3 h-3 rounded-sm bg-red-700" />Weak
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: "340px", height: `${height}px` }}>
          {ticks.map(tick => (
            <text key={tick.column} x={columnX(tick.column) + cellWidth / 2} y={padTop - 6} fontSize="7" fill="#475569" textAnchor="middle">
              {tick.label}
            </text>
          ))}
          {rows.map((category, rowIndex) => {
            const recent = (scoreHistory[category.id] ?? []).slice(-HEATMAP_DAYS);
            const cells: (number | null)[] = Array(HEATMAP_DAYS - recent.length).fill(null).concat(recent);
            const latest = recent[recent.length - 1] ?? null;
            const trend5d = recent.length >= 5 ? latest! - recent[recent.length - 5] : null;
            const trendColor = trend5d == null ? "#64748b" : trend5d > 0.03 ? "#4ade80" : trend5d < -0.03 ? "#f87171" : "#94a3b8";

            return (
              <g key={category.id}>
                <text x={padLeft + labelWidth - 2} y={rowY(rowIndex) + cellHeight * 0.72} fontSize="8" fill="#94a3b8" textAnchor="end" style={MONO}>
                  {category.etfTicker}
                </text>
                {cells.map((score, columnIndex) => (
                  <rect
                    key={columnIndex}
                    x={columnX(columnIndex)}
                    y={rowY(rowIndex)}
                    width={cellWidth}
                    height={cellHeight}
                    rx="1"
                    fill={scoreToColor(score)}
                    opacity={score == null ? 0.3 : 0.85}
                    // SVG rect has no typed `title` prop, but the attribute still renders a tooltip.
                    {...{ title: score != null ? `${category.etfTicker} · ${Math.round(score * 100)}/100` : "no data" }}
                  />
                ))}
                <text x={columnX(HEATMAP_DAYS) + 4} y={rowY(rowIndex) + cellHeight * 0.72} fontSize="8" fill={trendColor} textAnchor="start" style={MONO}>
                  {latest != null ? Math.round(latest * 100) : "—"}
                </text>
              </g>
            );
          })}
          <line
            x1={columnX(0)}
            x2={columnX(HEATMAP_DAYS - 1) + cellWidth}
            y1={height - padBottom + 2}
            y2={height - padBottom + 2}
            stroke="#334155"
            strokeWidth="0.5"
          />
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Each column = 1 trading day · Score 0–100 · Score rising right = momentum building
      </div>
    </div>
  );
};

const MAX_SEASONAL_ROWS = 18;

export const SeasonalHeatmap = ({
  seasonalReturns,
  categories,
}: {
  seasonalReturns: SeasonalReturn[];
  categories: CategorySummary[];
}) => {
  if (seasonalReturns.length === 0) return null;

  const returnsByCategory: Record<string, Record<number, SeasonalReturn>> = {};
  for (const seasonal of seasonalReturns) {
    if (!returnsByCategory[seasonal.categoryId]) returnsByCategory[seasonal.categoryId] = {};
    returnsByCategory[seasonal.categoryId][seasonal.month] = seasonal;
  }

  const rows = categories.filter(c => returnsByCategory[c.id]).slice(0, MAX_SEASONAL_ROWS);
  if (rows.length === 0) return null;

  const maxAbsReturn = Math.max(...seasonalReturns.map(r => Math.abs(r.avgReturn)), 0.01);
  const currentMonth = new Date().getMonth() + 1;

  const cellWidth = 32, cellHeight = 18, gap = 2;
  const labelWidth = 48, padLeft = 8, padRight = 8, padTop = 28, padBottom = 20;
  const innerWidth = 12 * (cellWidth + gap) - gap;
  const width = padLeft + labelWidth + 4 + innerWidth + padRight;
  const height = padTop + rows.length * (cellHeight + gap) - gap + padBottom;

  const columnX = (column: number) => padLeft + labelWidth + 4 + column * (cellWidth + gap);
  const rowY = (row: number) => padTop + row * (cellHeight + gap);

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-3">
        <SectionHeading>Seasonal Monthly Returns</SectionHeading>
        <div className="flex items-center gap-2 text-[9px] text-slate-600">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-700" />+ve
          <span className="inline-block w-3 h-3 rounded-sm bg-red-800" />-ve
          <span className="text-slate-700">· sample ≥2yr</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", minWidth: "480px", height: `${height}px` }}>
          {MONTH_LABELS.map((month, monthIndex) => (
            <text
              key={month}
              x={columnX(monthIndex) + cellWidth / 2}
              y={padTop - 8}
              fontSize="8"
              fill={monthIndex + 1 === currentMonth ? "#22d3ee" : "#475569"}
              textAnchor="middle"
              fontWeight={monthIndex + 1 === currentMonth ? "bold" : "normal"}
            >
              {month}
            </text>
          ))}
          {rows.map((category, rowIndex) => {
            const months = returnsByCategory[category.id] ?? {};
            return (
              <g key={category.id}>
                <text x={padLeft + labelWidth - 2} y={rowY(rowIndex) + cellHeight * 0.72} fontSize="8" fill="#94a3b8" textAnchor="end" style={MONO}>
                  {category.etfTicker}
                </text>
                {MONTH_LABELS.map((_, monthIndex) => {
                  const month = monthIndex + 1;
                  const avgReturn = months[month]?.avgReturn ?? null;
                  const isCurrentMonth = month === currentMonth;
                  return (
                    <g key={monthIndex}>
                      <rect
                        x={columnX(monthIndex)}
                        y={rowY(rowIndex)}
                        width={cellWidth}
                        height={cellHeight}
                        rx="2"
                        fill={avgReturn != null ? returnToColor(avgReturn, maxAbsReturn) : "#1e293b"}
                        opacity={avgReturn == null ? 0.3 : 0.9}
                        stroke={isCurrentMonth ? "#22d3ee" : "none"}
                        strokeWidth={isCurrentMonth ? "1" : "0"}
                      />
                      {avgReturn != null && (
                        <text
                          x={columnX(monthIndex) + cellWidth / 2}
                          y={rowY(rowIndex) + cellHeight * 0.72}
                          fontSize="7"
                          fill={Math.abs(avgReturn) > 0.02 ? "#e2e8f0" : "#94a3b8"}
                          textAnchor="middle"
                          style={MONO}
                        >
                          {avgReturn >= 0 ? "+" : ""}{(avgReturn * 100).toFixed(1)}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
          <line
            x1={columnX(0)}
            x2={columnX(11) + cellWidth}
            y1={height - padBottom + 2}
            y2={height - padBottom + 2}
            stroke="#334155"
            strokeWidth="0.5"
          />
        </svg>
      </div>
      <div className="text-[10px] text-slate-600 mt-1 text-center">
        Average monthly return by calendar month · current month highlighted in cyan · values in %
      </div>
    </div>
  );
};

"use client";

import { PortfolioSnapshot } from "@/lib/api";

interface Props {
  snapshots: PortfolioSnapshot[];
}

const W = 600;
const H = 120;
const PAD = { top: 10, right: 12, bottom: 24, left: 60 };

function toSvgPath(points: [number, number][]): string {
  if (points.length === 0) return "";
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
}

export default function PortfolioValueChart({ snapshots }: Props) {
  if (snapshots.length < 2) {
    return (
      <div className="flex items-center justify-center h-[140px] text-slate-600 text-xs">
        Not enough data — refresh prices daily to build history
      </div>
    );
  }

  const values = snapshots.map((s) => s.totalValueEur);
  const costs = snapshots
    .map((s) => s.totalCostEur)
    .filter((v): v is number => v != null && v > 0);

  const minV = Math.min(...values, ...(costs.length > 0 ? costs : []), 0);
  const maxV = Math.max(...values, ...(costs.length > 0 ? costs : []), 1);
  const range = maxV - minV || 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const toX = (i: number) => PAD.left + (i / (snapshots.length - 1)) * plotW;
  const toY = (v: number) => PAD.top + plotH - ((v - minV) / range) * plotH;

  const valuePoints = snapshots.map((s, i): [number, number] => [toX(i), toY(s.totalValueEur)]);
  const costPoints = snapshots
    .map((s, i): [number, number] | null =>
      s.totalCostEur != null && s.totalCostEur > 0 ? [toX(i), toY(s.totalCostEur)] : null
    )
    .filter((p): p is [number, number] => p !== null);

  // Filled area under value curve
  const areaPath =
    `${toSvgPath(valuePoints)} L${valuePoints[valuePoints.length - 1][0]},${PAD.top + plotH} L${valuePoints[0][0]},${PAD.top + plotH} Z`;

  const firstDate = snapshots[0].snapshotDate;
  const lastDate = snapshots[snapshots.length - 1].snapshotDate;
  const latestValue = values[values.length - 1];
  const earliestValue = values[0];
  const changePct = earliestValue > 0 ? ((latestValue - earliestValue) / earliestValue) * 100 : 0;
  const isPositive = changePct >= 0;

  // Y-axis ticks (3 levels)
  const yTicks = [minV, minV + range / 2, maxV];
  const formatEur = (v: number) =>
    v >= 1_000_000
      ? `€${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `€${(v / 1000).toFixed(0)}k`
      : `€${v.toFixed(0)}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium">Portfolio Value (EUR)</span>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-emerald-400 font-semibold">
            {formatEur(latestValue)}
          </span>
          <span
            className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
              isPositive
                ? "text-emerald-400 bg-emerald-950/40"
                : "text-red-400 bg-red-950/40"
            }`}
          >
            {isPositive ? "+" : ""}
            {changePct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-600">
            {firstDate} → {lastDate}
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: `${H}px` }}
        aria-label="Portfolio value history chart"
      >
        <defs>
          <linearGradient id="valueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="#334155"
                strokeWidth="0.5"
                strokeDasharray="3,3"
              />
              <text
                x={PAD.left - 4}
                y={y + 3}
                fontSize="8"
                fill="#64748b"
                textAnchor="end"
              >
                {formatEur(tick)}
              </text>
            </g>
          );
        })}

        {/* Cost basis line */}
        {costPoints.length > 1 && (
          <path
            d={toSvgPath(costPoints)}
            fill="none"
            stroke="#64748b"
            strokeWidth="1"
            strokeDasharray="4,3"
            opacity="0.6"
          />
        )}

        {/* Value area fill */}
        <path d={areaPath} fill="url(#valueGradient)" />

        {/* Value line */}
        <path
          d={toSvgPath(valuePoints)}
          fill="none"
          stroke={isPositive ? "#10b981" : "#ef4444"}
          strokeWidth="1.5"
        />

        {/* Latest value dot */}
        <circle
          cx={valuePoints[valuePoints.length - 1][0]}
          cy={valuePoints[valuePoints.length - 1][1]}
          r="2.5"
          fill={isPositive ? "#10b981" : "#ef4444"}
        />

        {/* X-axis date labels */}
        <text
          x={PAD.left}
          y={H - 4}
          fontSize="8"
          fill="#475569"
          textAnchor="start"
        >
          {firstDate}
        </text>
        {snapshots.length > 1 && (
          <text
            x={W - PAD.right}
            y={H - 4}
            fontSize="8"
            fill="#475569"
            textAnchor="end"
          >
            {lastDate}
          </text>
        )}

        {/* Cost basis legend */}
        {costPoints.length > 1 && (
          <g>
            <line
              x1={PAD.left + 4}
              y1={H - 12}
              x2={PAD.left + 18}
              y2={H - 12}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="4,3"
              opacity="0.6"
            />
            <text x={PAD.left + 22} y={H - 9} fontSize="7" fill="#475569">
              cost basis
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

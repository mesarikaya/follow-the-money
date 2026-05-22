"use client";

import { PortfolioAllocationEntry } from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  EQUITY_SECTOR:  "#3b82f6",
  PRECIOUS_METAL: "#eab308",
  FIXED_INCOME:   "#a855f7",
  CASH:           "#64748b",
  ALTERNATIVE:    "#06b6d4",
  CURRENCY:       "#10b981",
};

const NEUTRAL_COLOR = "#334155";

function slice(
  cx: number, cy: number, r: number, thickness: number,
  startAngle: number, endAngle: number, color: string, opacity = 1
): string {
  if (Math.abs(endAngle - startAngle) < 0.001) return "";
  const innerR = r - thickness;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);

  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

type Props = {
  allocations: PortfolioAllocationEntry[];
  alignmentScore: number;
  alignmentLabel: "ALIGNED" | "PARTIAL" | "MISALIGNED";
};

const ALIGNMENT_COLORS = {
  ALIGNED:    { text: "#34d399", label: "Aligned" },
  PARTIAL:    { text: "#fbbf24", label: "Partial" },
  MISALIGNED: { text: "#f87171", label: "Misaligned" },
};

export default function AllocationDonutChart({ allocations, alignmentScore, alignmentLabel }: Props) {
  const SIZE = 220;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const outerR = 88;
  const outerThick = 20;
  const optimalR = outerR - outerThick - 4;
  const optimalThick = 10;

  const totalActual = allocations.reduce((s, e) => s + e.allocationPct, 0);
  const totalOptimal = allocations.reduce((s, e) => s + (e.optimalAllocationPct ?? 0), 0);
  const GAP_RAD = 0.015;
  const START = -Math.PI / 2;

  let actualAngle = START;
  let optimalAngle = START;

  const actualSlices: { path: string; color: string; label: string; pct: number }[] = [];
  const optimalSlices: { path: string; color: string }[] = [];

  for (const entry of allocations) {
    const color = TYPE_COLORS[entry.categoryType ?? ""] ?? NEUTRAL_COLOR;
    const pct = entry.allocationPct;
    if (pct > 0.5 && totalActual > 0) {
      const sweep = ((pct / totalActual) * 2 * Math.PI) - GAP_RAD;
      const endA = actualAngle + sweep;
      actualSlices.push({
        path: slice(cx, cy, outerR, outerThick, actualAngle + GAP_RAD / 2, endA, color),
        color,
        label: entry.categoryId,
        pct,
      });
      actualAngle = endA + GAP_RAD;
    }
    const optPct = entry.optimalAllocationPct ?? 0;
    if (optPct > 0.5 && totalOptimal > 0) {
      const sweep = ((optPct / totalOptimal) * 2 * Math.PI) - GAP_RAD;
      const endO = optimalAngle + sweep;
      optimalSlices.push({
        path: slice(cx, cy, optimalR, optimalThick, optimalAngle + GAP_RAD / 2, endO, color),
        color,
      });
      optimalAngle = endO + GAP_RAD;
    }
  }

  const scorePercent = Math.round(alignmentScore * 100);
  const scoreColor = ALIGNMENT_COLORS[alignmentLabel].text;
  const scoreLabel = ALIGNMENT_COLORS[alignmentLabel].label;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Background rings */}
          <circle cx={cx} cy={cy} r={outerR - outerThick / 2} fill="none"
            stroke="#1e293b" strokeWidth={outerThick} />
          <circle cx={cx} cy={cy} r={optimalR - optimalThick / 2} fill="none"
            stroke="#1e293b" strokeWidth={optimalThick} />

          {/* Optimal allocation ring (inner, dimmer) */}
          {optimalSlices.map((s, i) => s.path && (
            <path key={`opt-${i}`} d={s.path} fill={s.color} fillOpacity={0.35} />
          ))}

          {/* Actual allocation ring (outer, vivid) */}
          {actualSlices.map((s, i) => s.path && (
            <path key={`act-${i}`} d={s.path} fill={s.color} fillOpacity={0.85} />
          ))}

          {/* Center score */}
          <text x={cx} y={cy - 10} textAnchor="middle" fontSize={28} fontWeight="700"
            fill={scoreColor} fontFamily="monospace">
            {scorePercent}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize={10} fill="#64748b">
            / 100
          </text>
          <text x={cx} y={cy + 26} textAnchor="middle" fontSize={11} fontWeight="600"
            fill={scoreColor}>
            {scoreLabel}
          </text>
        </svg>
      </div>

      <div className="flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm bg-blue-500 inline-block opacity-85" />
          Actual allocation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm bg-blue-500 inline-block opacity-35" />
          Signal-optimal
        </span>
      </div>
    </div>
  );
}

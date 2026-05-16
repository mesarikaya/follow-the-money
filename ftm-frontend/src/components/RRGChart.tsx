"use client";

import { useState } from "react";
import { RrgCategoryEntry } from "@/lib/api";

const VIEWBOX_SIZE = 480;
const PADDING = 40;
const CHART_SIZE = VIEWBOX_SIZE - PADDING * 2;

const QUADRANT_COLORS = {
  leading:   "rgba(34,197,94,0.10)",
  improving: "rgba(59,130,246,0.10)",
  weakening: "rgba(239,68,68,0.10)",
  lagging:   "rgba(107,114,128,0.10)",
};

const QUADRANT_LABELS = [
  { text: "Leading",   x: VIEWBOX_SIZE - PADDING - 4, y: PADDING + 14, anchor: "end",   color: "#22c55e" },
  { text: "Improving", x: PADDING + 4,                y: PADDING + 14, anchor: "start", color: "#3b82f6" },
  { text: "Weakening", x: VIEWBOX_SIZE - PADDING - 4, y: VIEWBOX_SIZE - PADDING - 6, anchor: "end",   color: "#ef4444" },
  { text: "Lagging",   x: PADDING + 4,                y: VIEWBOX_SIZE - PADDING - 6, anchor: "start", color: "#71717a" },
] as const;

type TooltipState = {
  x: number;
  y: number;
  name: string;
  ratio: number;
  momentum: number;
};

function deriveSymmetricScale(categories: RrgCategoryEntry[]): number {
  let halfRange = 2;
  for (const category of categories) {
    for (const point of category.trail) {
      halfRange = Math.max(
        halfRange,
        Math.abs(point.ratio - 100) + 1.5,
        Math.abs(point.momentum - 100) + 1.5
      );
    }
  }
  return halfRange;
}

function makeProjectors(halfRange: number) {
  const toX = (value: number) =>
    PADDING + ((value - (100 - halfRange)) / (2 * halfRange)) * CHART_SIZE;
  const toY = (value: number) =>
    PADDING + (((100 + halfRange) - value) / (2 * halfRange)) * CHART_SIZE;
  return { toX, toY };
}

type Props = { categories: RrgCategoryEntry[] };

export default function RRGChart({ categories }: Props) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const halfRange = deriveSymmetricScale(categories);
  const { toX, toY } = makeProjectors(halfRange);

  const originX = toX(100);
  const originY = toY(100);

  return (
    <div className="relative w-full" style={{ aspectRatio: "1 / 1", maxHeight: "min(55vh, 520px)" }}>
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        className="w-full h-full"
        aria-label="Relative Rotation Graph"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Quadrant backgrounds — equal size because origin is always at center */}
        <rect x={originX} y={PADDING}   width={VIEWBOX_SIZE - PADDING - originX} height={originY - PADDING}              fill={QUADRANT_COLORS.leading}   />
        <rect x={PADDING} y={PADDING}   width={originX - PADDING}                height={originY - PADDING}              fill={QUADRANT_COLORS.improving} />
        <rect x={originX} y={originY}   width={VIEWBOX_SIZE - PADDING - originX} height={VIEWBOX_SIZE - PADDING - originY} fill={QUADRANT_COLORS.weakening} />
        <rect x={PADDING} y={originY}   width={originX - PADDING}                height={VIEWBOX_SIZE - PADDING - originY} fill={QUADRANT_COLORS.lagging}   />

        {/* Axis lines */}
        <line x1={PADDING} y1={originY} x2={VIEWBOX_SIZE - PADDING} y2={originY} stroke="#3f3f46" strokeWidth={1} />
        <line x1={originX} y1={PADDING} x2={originX} y2={VIEWBOX_SIZE - PADDING} stroke="#3f3f46" strokeWidth={1} />

        {/* Quadrant labels */}
        {QUADRANT_LABELS.map((label) => (
          <text
            key={label.text}
            x={label.x}
            y={label.y}
            textAnchor={label.anchor}
            fontSize={10}
            fill={label.color}
            opacity={0.75}
          >
            {label.text}
          </text>
        ))}

        {/* Per-category trails and current-position dots */}
        {categories.map((category) => {
          if (category.trail.length === 0) return null;

          const points = category.trail.map((p) => ({
            x: toX(p.ratio),
            y: toY(p.momentum),
            ratio: p.ratio,
            momentum: p.momentum,
          }));
          const pathData = points
            .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
            .join(" ");
          const latest = points[points.length - 1];

          return (
            <g key={category.id}>
              <path
                d={pathData}
                fill="none"
                stroke={category.color}
                strokeWidth={1.5}
                strokeOpacity={0.35}
              />
              <circle
                cx={latest.x}
                cy={latest.y}
                r={6}
                fill={category.color}
                opacity={0.9}
                style={{ cursor: "pointer" }}
                onMouseEnter={() =>
                  setTooltip({
                    x: latest.x,
                    y: latest.y,
                    name: category.name,
                    ratio: latest.ratio,
                    momentum: latest.momentum,
                  })
                }
              />
              <text
                x={latest.x + 8}
                y={latest.y + 4}
                fontSize={9}
                fill={category.color}
                opacity={0.85}
                style={{ pointerEvents: "none" }}
              >
                {category.id}
              </text>
            </g>
          );
        })}

        {/* Axis labels */}
        <text
          x={VIEWBOX_SIZE / 2}
          y={VIEWBOX_SIZE - 6}
          textAnchor="middle"
          fontSize={10}
          fill="#52525b"
        >
          RS Ratio →
        </text>
        <text
          x={12}
          y={VIEWBOX_SIZE / 2}
          textAnchor="middle"
          fontSize={10}
          fill="#52525b"
          transform={`rotate(-90, 12, ${VIEWBOX_SIZE / 2})`}
        >
          RS Momentum
        </text>

        {/* Inline SVG tooltip */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x + 10}
              y={tooltip.y - 30}
              width={130}
              height={44}
              rx={4}
              fill="#18181b"
              stroke="#3f3f46"
              strokeWidth={1}
            />
            <text x={tooltip.x + 17} y={tooltip.y - 14} fontSize={10} fill="#e4e4e7" fontWeight="600">
              {tooltip.name}
            </text>
            <text x={tooltip.x + 17} y={tooltip.y - 2} fontSize={9} fill="#a1a1aa">
              {`Ratio: ${tooltip.ratio.toFixed(2)}  Mom: ${tooltip.momentum.toFixed(2)}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

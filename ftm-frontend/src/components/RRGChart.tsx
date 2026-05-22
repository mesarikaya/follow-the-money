"use client";

import { useState } from "react";
import { RrgCategoryEntry } from "@/lib/api";

const VIEWBOX_W = 680;
const VIEWBOX_H = 560;
const PAD_L = 52;
const PAD_R = 24;
const PAD_T = 28;
const PAD_B = 36;
const CHART_W = VIEWBOX_W - PAD_L - PAD_R;
const CHART_H = VIEWBOX_H - PAD_T - PAD_B;
const TRAIL_LEN = 8;

const QUADRANT_COLORS = {
  leading:   "#22c55e",
  improving: "#3b82f6",
  weakening: "#f97316",
  lagging:   "#64748b",
} as const;

type QKey = keyof typeof QUADRANT_COLORS;

function quadrantOf(ratio: number, momentum: number): QKey {
  if (ratio >= 100 && momentum >= 100) return "leading";
  if (ratio < 100 && momentum >= 100) return "improving";
  if (ratio >= 100 && momentum < 100) return "weakening";
  return "lagging";
}

function quadrantLabel(q: QKey): string {
  return { leading: "Leading", improving: "Improving", weakening: "Weakening", lagging: "Lagging" }[q];
}

function deriveHalfRange(categories: RrgCategoryEntry[]): number {
  let halfRange = 12;
  for (const cat of categories) {
    for (const p of cat.trail.slice(-TRAIL_LEN)) {
      halfRange = Math.max(halfRange, Math.abs(p.ratio - 100) + 2, Math.abs(p.momentum - 100) + 2);
    }
  }
  return Math.min(Math.ceil(halfRange), 22);
}

type TooltipInfo = {
  svgX: number;
  svgY: number;
  name: string;
  ticker: string;
  ratio: number;
  momentum: number;
  quadrant: QKey;
};

type Props = { categories: RrgCategoryEntry[]; etfTickers?: Record<string, string>; maxHeight?: string };

export default function RRGChart({ categories, etfTickers = {}, maxHeight = "min(72vh, 660px)" }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const halfRange = deriveHalfRange(categories);
  const axisMin = 100 - halfRange;
  const axisMax = 100 + halfRange;

  const toX = (v: number) => PAD_L + ((v - axisMin) / (axisMax - axisMin)) * CHART_W;
  const toY = (v: number) => PAD_T + ((axisMax - v) / (axisMax - axisMin)) * CHART_H;
  const clampX = (v: number) => Math.max(PAD_L + 1, Math.min(PAD_L + CHART_W - 1, toX(v)));
  const clampY = (v: number) => Math.max(PAD_T + 1, Math.min(PAD_T + CHART_H - 1, toY(v)));

  const cx = toX(100);
  const cy = toY(100);

  const gridTicks = [axisMin, 100 - Math.round(halfRange / 2), 100, 100 + Math.round(halfRange / 2), axisMax];

  const anyHovered = hoveredId !== null;

  return (
    <div
      className="relative w-full"
      style={{ aspectRatio: `${VIEWBOX_W} / ${VIEWBOX_H}`, maxHeight }}
    >
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className="w-full h-full"
        aria-label="Relative Rotation Graph"
        onMouseLeave={() => { setTooltip(null); setHoveredId(null); }}
      >
        <defs>
          <clipPath id="rrg-clip">
            <rect x={PAD_L} y={PAD_T} width={CHART_W} height={CHART_H} />
          </clipPath>
        </defs>

        {/* Quadrant fills */}
        <rect x={cx} y={PAD_T} width={PAD_L + CHART_W - cx} height={cy - PAD_T}
          fill={QUADRANT_COLORS.leading} fillOpacity={0.07} />
        <rect x={PAD_L} y={PAD_T} width={cx - PAD_L} height={cy - PAD_T}
          fill={QUADRANT_COLORS.improving} fillOpacity={0.07} />
        <rect x={PAD_L} y={cy} width={cx - PAD_L} height={PAD_T + CHART_H - cy}
          fill={QUADRANT_COLORS.lagging} fillOpacity={0.07} />
        <rect x={cx} y={cy} width={PAD_L + CHART_W - cx} height={PAD_T + CHART_H - cy}
          fill={QUADRANT_COLORS.weakening} fillOpacity={0.07} />

        {/* Chart border */}
        <rect x={PAD_L} y={PAD_T} width={CHART_W} height={CHART_H}
          fill="none" stroke="#1e293b" strokeWidth={1} />

        {/* Minor grid lines (halfway marks) */}
        {gridTicks.filter(v => v !== 100).map(v => {
          const gx = toX(v);
          const gy = toY(v);
          const isEdge = v === axisMin || v === axisMax;
          if (isEdge) return null;
          return (
            <g key={v}>
              <line x1={gx} y1={PAD_T} x2={gx} y2={PAD_T + CHART_H}
                stroke="#1e293b" strokeWidth={0.8} />
              <line x1={PAD_L} y1={gy} x2={PAD_L + CHART_W} y2={gy}
                stroke="#1e293b" strokeWidth={0.8} />
            </g>
          );
        })}

        {/* Main axis crosshairs */}
        <line x1={PAD_L} y1={cy} x2={PAD_L + CHART_W} y2={cy}
          stroke="#334155" strokeWidth={1.5} strokeDasharray="5,3" />
        <line x1={cx} y1={PAD_T} x2={cx} y2={PAD_T + CHART_H}
          stroke="#334155" strokeWidth={1.5} strokeDasharray="5,3" />

        {/* Axis tick labels — bottom x-axis */}
        {gridTicks.map(v => {
          const x = toX(v);
          const isCtr = v === 100;
          return (
            <text key={`xt-${v}`}
              x={x} y={PAD_T + CHART_H + 15}
              textAnchor="middle" fontSize={8.5}
              fill={isCtr ? "#64748b" : "#334155"}
              fontFamily="monospace"
              fontWeight={isCtr ? "700" : "400"}
            >
              {v}
            </text>
          );
        })}

        {/* Axis tick labels — left y-axis */}
        {gridTicks.map(v => {
          const y = toY(v);
          const isCtr = v === 100;
          return (
            <text key={`yt-${v}`}
              x={PAD_L - 6} y={y + 3.5}
              textAnchor="end" fontSize={8.5}
              fill={isCtr ? "#64748b" : "#334155"}
              fontFamily="monospace"
              fontWeight={isCtr ? "700" : "400"}
            >
              {v}
            </text>
          );
        })}

        {/* Axis labels */}
        <text x={PAD_L + CHART_W / 2} y={VIEWBOX_H - 4}
          textAnchor="middle" fontSize={10} fill="#475569" fontWeight="600">
          RS Ratio →
        </text>
        <text x={10} y={PAD_T + CHART_H / 2}
          textAnchor="middle" fontSize={10} fill="#475569" fontWeight="600"
          transform={`rotate(-90, 10, ${PAD_T + CHART_H / 2})`}>
          ↑ RS Momentum
        </text>

        {/* Quadrant corner labels */}
        <text x={PAD_L + CHART_W - 6} y={PAD_T + 15}
          textAnchor="end" fontSize={9} fill={QUADRANT_COLORS.leading} opacity={0.7} fontWeight="700">
          LEADING
        </text>
        <text x={PAD_L + 6} y={PAD_T + 15}
          textAnchor="start" fontSize={9} fill={QUADRANT_COLORS.improving} opacity={0.7} fontWeight="700">
          IMPROVING
        </text>
        <text x={PAD_L + 6} y={PAD_T + CHART_H - 7}
          textAnchor="start" fontSize={9} fill={QUADRANT_COLORS.lagging} opacity={0.7} fontWeight="700">
          LAGGING
        </text>
        <text x={PAD_L + CHART_W - 6} y={PAD_T + CHART_H - 7}
          textAnchor="end" fontSize={9} fill={QUADRANT_COLORS.weakening} opacity={0.7} fontWeight="700">
          WEAKENING
        </text>

        {/* SPY center reference */}
        <circle cx={cx} cy={cy} r={4.5}
          fill="#94a3b8" fillOpacity={0.5} stroke="#64748b" strokeWidth={1} />
        <text x={cx + 7} y={cy + 4}
          fontSize={9} fill="#64748b" fontFamily="monospace">SPY</text>

        {/* Trails and dots — clipped */}
        <g clipPath="url(#rrg-clip)">
          {categories.map((cat) => {
            if (cat.trail.length === 0) return null;

            const visible = cat.trail.slice(-TRAIL_LEN);
            const latest = visible[visible.length - 1];
            const q = quadrantOf(latest.ratio, latest.momentum);
            const color = QUADRANT_COLORS[q];
            const ticker = etfTickers[cat.id] ?? cat.id;

            const dotX = clampX(latest.ratio);
            const dotY = clampY(latest.momentum);
            const isHovered = hoveredId === cat.id;
            const dimmed = anyHovered && !isHovered;

            // Trail polyline
            const trailPts = visible
              .map(p => `${toX(p.ratio).toFixed(1)},${toY(p.momentum).toFixed(1)}`)
              .join(" ");

            // Label placement: place in direction away from (100,100)
            const dx = latest.ratio - 100;
            const dy = latest.momentum - 100;
            // Horizontal: label right of dot when ratio > 100, left when ratio ≤ 100
            const labelOffX = dx >= 0 ? 10 : -10;
            const labelAnchor = dx >= 0 ? "start" : "end";
            // Vertical: label above dot when momentum > 100, below when ≤ 100
            const labelOffY = dy >= 0 ? -6 : 14;
            const labelX = dotX + labelOffX;
            const labelY = dotY + labelOffY;

            return (
              <g
                key={cat.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => {
                  setHoveredId(cat.id);
                  setTooltip({ svgX: dotX, svgY: dotY, name: cat.name, ticker, ratio: latest.ratio, momentum: latest.momentum, quadrant: q });
                }}
              >
                {/* Trail */}
                {visible.length > 1 && (
                  <polyline
                    points={trailPts}
                    fill="none"
                    stroke={color}
                    strokeWidth={isHovered ? 2 : 1.5}
                    strokeOpacity={dimmed ? 0.08 : isHovered ? 0.6 : 0.28}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Trail tip arrow direction indicator (small filled dot at second-to-last point) */}
                {visible.length >= 2 && !dimmed && (
                  <circle
                    cx={toX(visible[visible.length - 2].ratio)}
                    cy={toY(visible[visible.length - 2].momentum)}
                    r={2.5}
                    fill={color}
                    fillOpacity={isHovered ? 0.6 : 0.25}
                  />
                )}

                {/* Main dot */}
                <circle
                  cx={dotX}
                  cy={dotY}
                  r={isHovered ? 9 : 7}
                  fill={color}
                  fillOpacity={dimmed ? 0.2 : isHovered ? 1 : 0.88}
                  stroke="#0f172a"
                  strokeWidth={isHovered ? 2.5 : 1.5}
                />

                {/* Ticker label with text outline for readability over overlapping labels */}
                <text
                  x={labelX}
                  y={labelY}
                  textAnchor={labelAnchor}
                  fontSize={9.5}
                  fontFamily="monospace"
                  fontWeight="700"
                  fill={color}
                  opacity={dimmed ? 0.15 : 1}
                  stroke="#0f172a"
                  strokeWidth={3}
                  paintOrder="stroke fill"
                  style={{ pointerEvents: "none" }}
                >
                  {ticker}
                </text>
              </g>
            );
          })}
        </g>

        {/* Hover tooltip */}
        {tooltip && (() => {
          const tipW = 162;
          const tipH = 72;
          const tipX = tooltip.svgX + 14 + tipW > VIEWBOX_W - 6
            ? tooltip.svgX - tipW - 10
            : tooltip.svgX + 14;
          const tipY = Math.max(PAD_T + 4, Math.min(PAD_T + CHART_H - tipH - 4, tooltip.svgY - tipH / 2));
          const color = QUADRANT_COLORS[tooltip.quadrant];
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tipX} y={tipY} width={tipW} height={tipH}
                rx={5} fill="#0f172a" stroke="#334155" strokeWidth={1} />
              <text x={tipX + 10} y={tipY + 19}
                fontSize={11} fill="#e2e8f0" fontWeight="700">{tooltip.name}</text>
              <text x={tipX + 10} y={tipY + 33}
                fontSize={8.5} fill="#64748b" fontFamily="monospace">{tooltip.ticker}</text>
              <text x={tipX + 10} y={tipY + 47}
                fontSize={9} fill={color} fontWeight="600">{quadrantLabel(tooltip.quadrant)}</text>
              <text x={tipX + 10} y={tipY + 61}
                fontSize={8.5} fill="#94a3b8" fontFamily="monospace">
                {`Ratio: ${tooltip.ratio.toFixed(2)}  Mom: ${tooltip.momentum.toFixed(2)}`}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

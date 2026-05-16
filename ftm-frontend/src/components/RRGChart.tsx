"use client";

import { RrgCategoryEntry } from "@/lib/api";

const W = 560;
const H = 560;
const PAD = 44;
const INNER_W = W - PAD * 2;
const INNER_H = H - PAD * 2;

const Q_COLORS = {
  leading:   "rgba(34,197,94,0.08)",
  improving: "rgba(59,130,246,0.08)",
  weakening: "rgba(239,68,68,0.08)",
  lagging:   "rgba(107,114,128,0.08)",
};

type Scale = { xMin: number; xMax: number; yMin: number; yMax: number };

function deriveScale(categories: RrgCategoryEntry[]): Scale {
  let xMin = 100, xMax = 100, yMin = 100, yMax = 100;
  for (const cat of categories) {
    for (const p of cat.trail) {
      if (p.ratio    < xMin) xMin = p.ratio;
      if (p.ratio    > xMax) xMax = p.ratio;
      if (p.momentum < yMin) yMin = p.momentum;
      if (p.momentum > yMax) yMax = p.momentum;
    }
  }
  const pad = 1.5;
  const xHalf = Math.max((xMax - xMin) / 2, 2) + pad;
  const yHalf = Math.max((yMax - yMin) / 2, 2) + pad;
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  return { xMin: cx - xHalf, xMax: cx + xHalf, yMin: cy - yHalf, yMax: cy + yHalf };
}

function makeProjectors(scale: Scale) {
  const toX = (v: number) => PAD + ((v - scale.xMin) / (scale.xMax - scale.xMin)) * INNER_W;
  const toY = (v: number) => PAD + ((scale.yMax - v) / (scale.yMax - scale.yMin)) * INNER_H;
  return { toX, toY };
}

type Props = { categories: RrgCategoryEntry[] };

export default function RRGChart({ categories }: Props) {
  const scale = deriveScale(categories);
  const { toX, toY } = makeProjectors(scale);

  const cx = toX(100);
  const cy = toY(100);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Relative Rotation Graph"
    >
      {/* Quadrant backgrounds */}
      <rect x={cx} y={PAD}  width={W - PAD - cx} height={cy - PAD}  fill={Q_COLORS.leading} />
      <rect x={PAD} y={PAD}  width={cx - PAD}     height={cy - PAD}  fill={Q_COLORS.improving} />
      <rect x={cx} y={cy}   width={W - PAD - cx} height={H - PAD - cy} fill={Q_COLORS.weakening} />
      <rect x={PAD} y={cy}   width={cx - PAD}     height={H - PAD - cy} fill={Q_COLORS.lagging} />

      {/* Axis lines at RS_Ratio=100, RS_Momentum=100 */}
      <line x1={PAD} y1={cy} x2={W - PAD} y2={cy} stroke="#3f3f46" strokeWidth={1} />
      <line x1={cx} y1={PAD} x2={cx} y2={H - PAD} stroke="#3f3f46" strokeWidth={1} />

      {/* Quadrant labels */}
      <text x={W - PAD - 4} y={PAD + 14} textAnchor="end"   fontSize={10} fill="#22c55e" opacity={0.7}>Leading</text>
      <text x={PAD + 4}     y={PAD + 14} textAnchor="start" fontSize={10} fill="#3b82f6" opacity={0.7}>Improving</text>
      <text x={W - PAD - 4} y={H - PAD - 6} textAnchor="end"   fontSize={10} fill="#ef4444" opacity={0.7}>Weakening</text>
      <text x={PAD + 4}     y={H - PAD - 6} textAnchor="start" fontSize={10} fill="#71717a" opacity={0.7}>Lagging</text>

      {/* Per-category trails and current-position dots */}
      {categories.map((cat) => {
        if (cat.trail.length === 0) return null;

        const pts = cat.trail.map((p) => ({ x: toX(p.ratio), y: toY(p.momentum) }));
        const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const last = pts[pts.length - 1];

        return (
          <g key={cat.id}>
            <path d={pathD} fill="none" stroke={cat.color} strokeWidth={1.5} strokeOpacity={0.4} />
            <circle cx={last.x} cy={last.y} r={5} fill={cat.color} opacity={0.9}>
              <title>{cat.name}</title>
            </circle>
            <text x={last.x + 7} y={last.y + 4} fontSize={9} fill={cat.color} opacity={0.85}>
              {cat.id}
            </text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#52525b">RS Ratio →</text>
      <text
        x={12}
        y={H / 2}
        textAnchor="middle"
        fontSize={10}
        fill="#52525b"
        transform={`rotate(-90, 12, ${H / 2})`}
      >
        RS Momentum
      </text>
    </svg>
  );
}

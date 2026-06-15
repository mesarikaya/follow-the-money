"use client";

import { CategorySummary } from "@/lib/api";

type Props = {
  categories: CategorySummary[];
};

type VelocityRow = {
  categoryId: string;
  name: string;
  etfTicker: string;
  tradeSignal: string | null;
  compositeScore: number | null;
  velocityRaw: number;
  daysToNextSignal: number | null;
  nextSignalLabel: string | null;
};

// Thresholds in 0-1 scale (compositeScore is 0-1, compositeTrend5d is 0-1 units/day)
const SIGNAL_THRESHOLDS: Record<string, number> = {
  BUY: 0.50,
  WATCH: 0.40,
  HOLD: 0.30,
  REDUCE: 0,
};

const SIGNAL_ORDER = ["BUY", "WATCH", "HOLD", "REDUCE"];

function computeDaysToNextSignal(
  score: number | null,
  velocity: number,
  currentSignal: string | null,
): { days: number | null; label: string | null } {
  if (score == null || velocity === 0 || currentSignal == null) return { days: null, label: null };

  const currentIndex = SIGNAL_ORDER.indexOf(currentSignal);
  if (currentIndex === -1) return { days: null, label: null };

  if (velocity > 0 && currentIndex > 0) {
    const nextSignal = SIGNAL_ORDER[currentIndex - 1];
    const targetScore = SIGNAL_THRESHOLDS[nextSignal];
    if (targetScore > score) {
      const days = Math.ceil((targetScore - score) / velocity);
      if (days > 0 && days <= 30) return { days, label: nextSignal };
    }
  }

  if (velocity < 0 && currentIndex < SIGNAL_ORDER.length - 1) {
    const nextSignal = SIGNAL_ORDER[currentIndex + 1];
    const floorScore = SIGNAL_THRESHOLDS[currentSignal];
    if (floorScore != null && score > floorScore) {
      const days = Math.ceil((score - floorScore) / Math.abs(velocity));
      if (days > 0 && days <= 30) return { days, label: nextSignal };
    }
  }

  return { days: null, label: null };
}

function buildVelocityRows(categories: CategorySummary[]): VelocityRow[] {
  return categories
    .filter((c) => c.compositeTrend5d != null && c.compositeScore != null)
    .map((c) => {
      const velocity = c.compositeTrend5d ?? 0;
      const { days, label } = computeDaysToNextSignal(c.compositeScore, velocity, c.tradeSignal);
      return {
        categoryId: c.id,
        name: c.name,
        etfTicker: c.etfTicker,
        tradeSignal: c.tradeSignal,
        compositeScore: c.compositeScore,
        velocityRaw: velocity,
        daysToNextSignal: days,
        nextSignalLabel: label,
      };
    });
}

const SIGNAL_COLOR: Record<string, string> = {
  BUY: "text-emerald-400",
  WATCH: "text-cyan-400",
  HOLD: "text-slate-400",
  REDUCE: "text-red-400",
};

function VelocityBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = maxAbs > 0 ? Math.min(Math.abs(value) / maxAbs, 1) : 0;
  return (
    <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${value >= 0 ? "bg-emerald-500" : "bg-red-500"}`}
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  );
}

function VelocityRowItem({
  row,
  maxAbs,
  isAccelerating,
}: {
  row: VelocityRow;
  maxAbs: number;
  isAccelerating: boolean;
}) {
  const signalColor = SIGNAL_COLOR[row.nextSignalLabel ?? ""] ?? "text-slate-400";
  const scoreDisplay = row.compositeScore != null ? Math.round(row.compositeScore * 100) : "—";
  const velocityPts = (row.velocityRaw * 100).toFixed(1);
  const velocityLabel = isAccelerating ? `+${velocityPts}pt/d` : `${velocityPts}pt/d`;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
      <div className="w-9 shrink-0 text-right">
        <span className="font-mono text-xs font-semibold text-slate-200">{row.etfTicker}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-slate-300 truncate">{row.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <VelocityBar value={row.velocityRaw} maxAbs={maxAbs} />
          <span
            className={`text-[10px] font-mono ${isAccelerating ? "text-emerald-400" : "text-red-400"}`}
          >
            {velocityLabel}
          </span>
        </div>
      </div>
      <div className="shrink-0 text-right space-y-0.5">
        <div className="text-xs text-slate-300 font-mono">{scoreDisplay}</div>
        {row.daysToNextSignal != null && row.nextSignalLabel != null && (
          <div className={`text-[10px] ${signalColor}`}>
            ≈{row.daysToNextSignal}d→{row.nextSignalLabel}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MomentumVelocityRadar({ categories }: Props) {
  const rows = buildVelocityRows(categories);
  const accelerating = [...rows].sort((a, b) => b.velocityRaw - a.velocityRaw).slice(0, 5);
  const decelerating = [...rows].sort((a, b) => a.velocityRaw - b.velocityRaw).slice(0, 5);

  if (accelerating.length === 0 && decelerating.length === 0) return null;

  const maxAbsAcc = accelerating.reduce((m, r) => Math.max(m, Math.abs(r.velocityRaw)), 0.001);
  const maxAbsDec = decelerating.reduce((m, r) => Math.max(m, Math.abs(r.velocityRaw)), 0.001);

  return (
    <section
      data-testid="momentum-velocity-radar"
      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-4"
    >
      <h2 className="text-sm font-semibold text-slate-200 mb-4">Momentum Velocity</h2>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-emerald-400 font-medium mb-2 flex items-center gap-1">
            <span>▲</span> Rising
          </div>
          {accelerating.map((row) => (
            <VelocityRowItem
              key={row.categoryId}
              row={row}
              maxAbs={maxAbsAcc}
              isAccelerating={true}
            />
          ))}
        </div>
        <div>
          <div className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1">
            <span>▼</span> Fading
          </div>
          {decelerating.map((row) => (
            <VelocityRowItem
              key={row.categoryId}
              row={row}
              maxAbs={maxAbsDec}
              isAccelerating={false}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

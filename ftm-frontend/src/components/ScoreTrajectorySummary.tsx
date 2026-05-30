import { CategorySummary } from "@/lib/api";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type Trajectory = "rising" | "peaked" | "declining" | "recovering" | "stable";

type SectorTrajectory = {
  id: string;
  name: string;
  etfTicker: string;
  trajectory: Trajectory;
  delta: number;
  score: number | null;
  hasDrilldown: boolean;
};

function classifyTrajectory(history: number[]): { trajectory: Trajectory; delta: number } {
  if (history.length < 15) return { trajectory: "stable", delta: 0 };

  const len = history.length;
  const third = Math.floor(len / 3);
  const t1 = history.slice(0, third);
  const t2 = history.slice(third, third * 2);
  const t3 = history.slice(third * 2);

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const a1 = avg(t1);
  const a2 = avg(t2);
  const a3 = avg(t3);

  // delta = total change from start to end (in 0–1 units, ×100 for pts)
  const delta = a3 - a1;

  // Thresholds in score-fraction units (0.03 = 3 pts out of 100)
  const THRESHOLD = 0.03;

  const risingStart = a2 > a1 + THRESHOLD;
  const risingEnd = a3 > a2 + THRESHOLD;
  const fallingStart = a2 < a1 - THRESHOLD;
  const fallingEnd = a3 < a2 - THRESHOLD;

  if (risingStart && risingEnd) return { trajectory: "rising", delta };
  if (fallingStart && fallingEnd) return { trajectory: "declining", delta };
  if (risingStart && fallingEnd) return { trajectory: "peaked", delta };
  if (fallingStart && risingEnd) return { trajectory: "recovering", delta };
  return { trajectory: "stable", delta };
}

const TRAJECTORY_CONFIG: Record<Trajectory, {
  label: string;
  chipClass: string;
  dotClass: string;
  description: string;
  headerClass: string;
}> = {
  rising: {
    label: "Building Momentum",
    chipClass: "bg-green-900/50 text-green-300 border border-green-700/50",
    dotClass: "bg-green-400",
    description: "Score rising consistently over 30d",
    headerClass: "text-green-400",
  },
  recovering: {
    label: "Recovering",
    chipClass: "bg-cyan-900/40 text-cyan-300 border border-cyan-700/40",
    dotClass: "bg-cyan-400",
    description: "Bottomed and turning up",
    headerClass: "text-cyan-400",
  },
  stable: {
    label: "Stable",
    chipClass: "bg-slate-700/40 text-slate-400 border border-slate-600/40",
    dotClass: "bg-slate-500",
    description: "Score holding within ±3pts",
    headerClass: "text-slate-400",
  },
  peaked: {
    label: "Peaked & Rolling",
    chipClass: "bg-amber-900/40 text-amber-300 border border-amber-700/40",
    dotClass: "bg-amber-400",
    description: "Was rising, now fading",
    headerClass: "text-amber-400",
  },
  declining: {
    label: "Losing Momentum",
    chipClass: "bg-red-900/40 text-red-400 border border-red-700/40",
    dotClass: "bg-red-500",
    description: "Score declining consistently",
    headerClass: "text-red-400",
  },
};

const TRAJECTORY_ORDER: Trajectory[] = ["rising", "recovering", "stable", "peaked", "declining"];

type Props = {
  categories: CategorySummary[];
  scoreHistory: Record<string, number[]>;
};

export default function ScoreTrajectorySummary({ categories, scoreHistory }: Props) {
  const equities = categories.filter(c => c.type === "EQUITY_SECTOR");
  if (equities.length === 0) return null;

  const trajectories: SectorTrajectory[] = equities
    .map(cat => {
      const history = scoreHistory[cat.id] ?? [];
      const { trajectory, delta } = classifyTrajectory(history);
      return {
        id: cat.id,
        name: cat.name,
        etfTicker: cat.etfTicker,
        trajectory,
        delta,
        score: cat.compositeScore,
        hasDrilldown: SECTOR_DRILLDOWN_IDS.has(cat.id),
      };
    })
    .filter(s => s.score != null);

  if (trajectories.length === 0) return null;

  const grouped = TRAJECTORY_ORDER.reduce<Record<Trajectory, SectorTrajectory[]>>(
    (acc, t) => ({ ...acc, [t]: trajectories.filter(s => s.trajectory === t) }),
    {} as Record<Trajectory, SectorTrajectory[]>
  );

  const risingCount = grouped.rising.length;
  const decliningCount = grouped.declining.length;
  const broadening = risingCount > decliningCount;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center justify-between gap-3 bg-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Score Trajectory
          </span>
          <span className="text-[9px] text-slate-600">30-day momentum trend per sector</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {risingCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-green-900/40 border border-green-700/40 text-green-400">
              {risingCount} rising
            </span>
          )}
          {decliningCount > 0 && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-red-900/30 border border-red-700/40 text-red-400">
              {decliningCount} fading
            </span>
          )}
          <span className={`text-[9px] px-2 py-0.5 rounded border ${broadening ? "bg-green-900/20 border-green-700/30 text-green-500" : "bg-red-900/20 border-red-700/30 text-red-500"}`}>
            {broadening ? "Breadth expanding" : "Breadth narrowing"}
          </span>
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-5 gap-3">
        {TRAJECTORY_ORDER.map(traj => {
          const config = TRAJECTORY_CONFIG[traj];
          const members = grouped[traj];
          return (
            <div key={traj} className={`space-y-1.5 ${members.length === 0 ? "opacity-30" : ""}`}>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass}`} />
                <span className={`text-[9px] font-semibold uppercase tracking-wider ${config.headerClass}`}>
                  {config.label}
                </span>
                {members.length > 0 && (
                  <span className="text-[8px] text-slate-600">({members.length})</span>
                )}
              </div>
              <div className="space-y-1">
                {members.length === 0 ? (
                  <span className="text-[9px] text-slate-700">—</span>
                ) : (
                  members.map(s => {
                    const deltaPts = Math.round(Math.abs(s.delta) * 100);
                    const sign = s.delta >= 0 ? "+" : "−";
                    const chip = (
                      <div
                        key={s.id}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] ${config.chipClass}`}
                        title={`${s.name} — ${config.description}. ${sign}${deltaPts}pts over 30d. Score: ${s.score != null ? Math.round(s.score * 100) : "??"}${"/100"}`}
                      >
                        <span className="font-mono font-bold">{s.etfTicker}</span>
                        {deltaPts >= 2 && (
                          <span className="opacity-60 tabular-nums">{sign}{deltaPts}</span>
                        )}
                      </div>
                    );
                    return s.hasDrilldown ? (
                      <Link key={s.id} href={`/sectors/${s.id}`} className="block hover:opacity-80 transition-opacity">
                        {chip}
                      </Link>
                    ) : (
                      <div key={s.id}>{chip}</div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-1.5 border-t border-slate-700/30 text-[9px] text-slate-600 flex items-center gap-4">
        <span>Rising = score built consistently over 30d · Peaked = rising then fading · Recovering = bottomed &amp; turning up</span>
      </div>
    </div>
  );
}

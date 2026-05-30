import { CategorySummary } from "@/lib/api";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type DivergenceType =
  | "SCORE_HIGH_RRG_WEAKENING"
  | "SCORE_LOW_RRG_IMPROVING"
  | "RS_ACCEL_EMERGING"
  | "RS_DECEL_FADING"
  | "REGIME_TAILWIND_WEAK_SCORE"
  | "REGIME_HEADWIND_STRONG_SCORE";

const DIVERGENCE_CONFIG: Record<
  DivergenceType,
  { title: string; note: string; interpretation: string; scoreBadgeClass: string; quadrantLabel: string }
> = {
  SCORE_HIGH_RRG_WEAKENING: {
    title: "Score ↑ / RRG ↘",
    note: "composite strong but RS fading",
    interpretation: "High composite score with weakening RRG momentum — possible rotation peak. Watch for score deterioration.",
    scoreBadgeClass: "bg-green-900/30 text-green-300 border border-green-700/30",
    quadrantLabel: "↘ Weakening",
  },
  SCORE_LOW_RRG_IMPROVING: {
    title: "Score ↓ / RRG ↖",
    note: "composite weak but RS building",
    interpretation: "Low composite score with improving RRG momentum — potential early-stage recovery. Watch for score breakout above 40.",
    scoreBadgeClass: "bg-red-900/30 text-red-300 border border-red-700/30",
    quadrantLabel: "↖ Improving",
  },
  RS_ACCEL_EMERGING: {
    title: "RS ↗ / Score Lagging",
    note: "RS accelerating, composite not yet confirming",
    interpretation: "Near-term RS (60d) running faster than long-term baseline (120d), but composite score hasn't caught up. Possible early rotation leader — watch for composite breakout.",
    scoreBadgeClass: "bg-cyan-900/30 text-cyan-300 border border-cyan-700/30",
    quadrantLabel: "",
  },
  RS_DECEL_FADING: {
    title: "RS ↘ / Score Elevated",
    note: "RS decelerating, composite still high",
    interpretation: "Near-term RS (60d) falling below long-term baseline (120d) while composite score remains elevated. Composite lags the reversal — watch for distribution before score falls.",
    scoreBadgeClass: "bg-orange-900/30 text-orange-300 border border-orange-700/30",
    quadrantLabel: "",
  },
  REGIME_TAILWIND_WEAK_SCORE: {
    title: "Regime ↑ / Score Lagging",
    note: "historically strong regime, weak current score",
    interpretation: "This sector has a high historical win rate in the current macro regime, but the composite score is currently weak. Regime tailwind not yet showing up in price — watch for early-entry opportunity.",
    scoreBadgeClass: "bg-violet-900/30 text-violet-300 border border-violet-700/30",
    quadrantLabel: "",
  },
  REGIME_HEADWIND_STRONG_SCORE: {
    title: "Regime ↓ / Score Elevated",
    note: "historically weak regime, strong current score",
    interpretation: "This sector has a low historical win rate in the current macro regime, but the composite score is elevated. Momentum running against the macro — watch for regime-driven reversal.",
    scoreBadgeClass: "bg-rose-900/30 text-rose-300 border border-rose-700/30",
    quadrantLabel: "",
  },
};

type DivergenceEntry = { cat: CategorySummary; type: DivergenceType };

function DivergenceRow({ entry }: { entry: DivergenceEntry }) {
  const config = DIVERGENCE_CONFIG[entry.type];
  const score = Math.round((entry.cat.compositeScore ?? 0) * 100);
  const isRsType = entry.type === "RS_ACCEL_EMERGING" || entry.type === "RS_DECEL_FADING";
  const rsAccelPts =
    isRsType && entry.cat.rs60 != null && entry.cat.rs120 != null
      ? Math.round((entry.cat.rs60 - entry.cat.rs120) * 100)
      : null;
  const hasDrilldown = SECTOR_DRILLDOWN_IDS.has(entry.cat.id);

  return (
    <div
      className="flex items-center gap-3 py-1.5 border-b border-slate-700/30 last:border-0"
      title={config.interpretation}
    >
      <span className="font-mono text-xs w-10 shrink-0" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
        {hasDrilldown ? (
          <Link href={`/sectors/${entry.cat.id}`} className="text-cyan-400 hover:text-cyan-300 transition-colors">
            {entry.cat.etfTicker}
          </Link>
        ) : (
          <span className="text-cyan-400">{entry.cat.etfTicker}</span>
        )}
      </span>
      <span className="flex-1 text-xs text-slate-300 truncate">{entry.cat.name}</span>
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${config.scoreBadgeClass}`}>
        {score}/100
      </span>
      {isRsType && rsAccelPts != null ? (
        <span
          className={`text-[10px] font-mono shrink-0 ${rsAccelPts > 0 ? "text-emerald-400" : "text-red-400"}`}
          title="RS acceleration: 60d minus 120d relative strength (in percentage points)"
        >
          {rsAccelPts > 0 ? "+" : ""}{rsAccelPts}pts
        </span>
      ) : (
        <span className="text-[10px] text-slate-500 shrink-0">{config.quadrantLabel}</span>
      )}
    </div>
  );
}

export default function SignalDivergencePanel({ categories }: { categories: CategorySummary[] }) {
  const divergences: DivergenceEntry[] = [];
  const rsSignals: DivergenceEntry[] = [];
  const regimeSignals: DivergenceEntry[] = [];

  for (const cat of categories) {
    if (cat.type !== "EQUITY_SECTOR") continue;

    const score = cat.compositeScore;
    const quadrant = cat.rrgQuadrant;

    if (score != null && quadrant != null) {
      if (score >= 0.65 && quadrant === "2") {
        divergences.push({ cat, type: "SCORE_HIGH_RRG_WEAKENING" });
      } else if (score < 0.40 && quadrant === "3") {
        divergences.push({ cat, type: "SCORE_LOW_RRG_IMPROVING" });
      }
    }

    if (cat.rs60 != null && cat.rs120 != null && score != null) {
      const rsAccel = cat.rs60 - cat.rs120;
      if (rsAccel > 0.01 && score < 0.55) {
        rsSignals.push({ cat, type: "RS_ACCEL_EMERGING" });
      } else if (rsAccel < -0.01 && score >= 0.60) {
        rsSignals.push({ cat, type: "RS_DECEL_FADING" });
      }
    }

    if (cat.macroFit != null && score != null) {
      if (cat.macroFit >= 0.65 && score < 0.45) {
        regimeSignals.push({ cat, type: "REGIME_TAILWIND_WEAK_SCORE" });
      } else if (cat.macroFit <= 0.35 && score >= 0.65) {
        regimeSignals.push({ cat, type: "REGIME_HEADWIND_STRONG_SCORE" });
      }
    }
  }

  if (divergences.length === 0 && rsSignals.length === 0 && regimeSignals.length === 0) return null;

  const peaks    = divergences.filter(d => d.type === "SCORE_HIGH_RRG_WEAKENING");
  const recovers = divergences.filter(d => d.type === "SCORE_LOW_RRG_IMPROVING");
  const accelEmerging = rsSignals.filter(d => d.type === "RS_ACCEL_EMERGING");
  const decelFading   = rsSignals.filter(d => d.type === "RS_DECEL_FADING");
  const regimeTailwind = regimeSignals.filter(d => d.type === "REGIME_TAILWIND_WEAK_SCORE");
  const regimeHeadwind = regimeSignals.filter(d => d.type === "REGIME_HEADWIND_STRONG_SCORE");
  const hasRsRow = accelEmerging.length > 0 || decelFading.length > 0;
  const hasRegimeRow = regimeTailwind.length > 0 || regimeHeadwind.length > 0;

  return (
    <div className="space-y-3">
      {divergences.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-amber-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rotation Peak?</span>
              <span className="text-[10px] text-slate-600 ml-auto">score strong, momentum fading</span>
            </div>
            {peaks.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">No divergences</p>
            ) : (
              peaks.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>

          <div className="bg-slate-800/40 border border-blue-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Early Recovery?</span>
              <span className="text-[10px] text-slate-600 ml-auto">score weak, momentum building</span>
            </div>
            {recovers.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">No divergences</p>
            ) : (
              recovers.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>
        </div>
      )}

      {hasRsRow && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-cyan-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RS Emerging ↗</span>
              <span className="text-[10px] text-slate-600 ml-auto">60d RS &gt; 120d, score lagging</span>
            </div>
            {accelEmerging.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              accelEmerging.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>

          <div className="bg-slate-800/40 border border-orange-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">RS Fading ↘</span>
              <span className="text-[10px] text-slate-600 ml-auto">60d RS &lt; 120d, score elevated</span>
            </div>
            {decelFading.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              decelFading.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>
        </div>
      )}

      {hasRegimeRow && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-violet-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Regime Tailwind ↑</span>
              <span className="text-[10px] text-slate-600 ml-auto">fit ≥65%, score weak</span>
            </div>
            {regimeTailwind.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              regimeTailwind.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>

          <div className="bg-slate-800/40 border border-rose-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Regime Headwind ↓</span>
              <span className="text-[10px] text-slate-600 ml-auto">fit ≤35%, score elevated</span>
            </div>
            {regimeHeadwind.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              regimeHeadwind.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { CategorySummary } from "@/lib/api";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type DivergenceType =
  | "SCORE_HIGH_RRG_WEAKENING"
  | "SCORE_LOW_RRG_IMPROVING"
  | "RS_ACCEL_EMERGING"
  | "RS_DECEL_FADING"
  | "REGIME_TAILWIND_WEAK_SCORE"
  | "REGIME_HEADWIND_STRONG_SCORE"
  | "PERSIST_HIGH_SCORE_LOW"
  | "PERSIST_LOW_SCORE_HIGH"
  | "VELOCITY_ACCEL_RS_LAGGING"
  | "VELOCITY_DECEL_RS_STRONG"
  | "FLOW_LEADS_SCORE"
  | "FLOW_DISTRIBUTION";

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
  PERSIST_HIGH_SCORE_LOW: {
    title: "Persist ↑ / Score Lagging",
    note: "daily outperformance consistent, composite not yet confirming",
    interpretation: "Sector beats benchmark consistently (≥12/20 days) but composite score is weak (<45). Breadth of outperformance is strong — composite may be lagging the daily reality. Potential early entry.",
    scoreBadgeClass: "bg-teal-900/30 text-teal-300 border border-teal-700/30",
    quadrantLabel: "",
  },
  PERSIST_LOW_SCORE_HIGH: {
    title: "Persist ↓ / Score Elevated",
    note: "high composite, thin daily outperformance",
    interpretation: "Composite score is high (≥65) but persistence is weak (<7/20 days). Score may be propped by a few big-move days rather than consistent outperformance. Watch for fragile leadership reversing.",
    scoreBadgeClass: "bg-yellow-900/30 text-yellow-300 border border-yellow-700/30",
    quadrantLabel: "",
  },
  VELOCITY_ACCEL_RS_LAGGING: {
    title: "Breadth ⚡ / RS Lagging",
    note: "daily hit-rate accelerating, RS not yet confirmed",
    interpretation: "Breadth velocity is strongly accelerating (recent-5d outperformance rate is ≥10pp above the prior-15d baseline), but RS-60 is still near zero or negative. Consistency of outperformance is building ahead of the RS signal — potential early rotation leader.",
    scoreBadgeClass: "bg-emerald-900/30 text-emerald-300 border border-emerald-700/30",
    quadrantLabel: "",
  },
  VELOCITY_DECEL_RS_STRONG: {
    title: "Breadth ⬇ / RS Elevated",
    note: "daily hit-rate decelerating, RS still strong",
    interpretation: "Breadth velocity is sharply decelerating (recent-5d outperformance rate is ≥10pp below the prior-15d baseline), but RS-60 remains elevated. The breadth of outperformance is deteriorating while the headline RS number hasn't caught up — potential early distribution signal.",
    scoreBadgeClass: "bg-orange-900/30 text-orange-300 border border-orange-700/30",
    quadrantLabel: "",
  },
  FLOW_LEADS_SCORE: {
    title: "Flow ↑ / Score Lagging",
    note: "institutional inflows arriving ahead of composite",
    interpretation: "Strong institutional inflows (flow z ≥ 1.5σ) while composite score is still weak (<55). Smart money is accumulating before price momentum shows up in the composite. This pattern frequently precedes a score breakout — watch for composite crossing 0.55.",
    scoreBadgeClass: "bg-teal-900/30 text-teal-300 border border-teal-700/30",
    quadrantLabel: "",
  },
  FLOW_DISTRIBUTION: {
    title: "Flow ↓ / Score Elevated",
    note: "institutional outflows despite strong composite",
    interpretation: "Institutional outflows (flow z ≤ −0.8σ) while composite score is still elevated (≥65). Smart money is quietly reducing exposure while price momentum appears strong — potential early distribution ahead of a composite pullback.",
    scoreBadgeClass: "bg-rose-900/30 text-rose-300 border border-rose-700/30",
    quadrantLabel: "",
  },
};

type DivergenceEntry = { cat: CategorySummary; type: DivergenceType };

function DivergenceRow({ entry }: { entry: DivergenceEntry }) {
  const config = DIVERGENCE_CONFIG[entry.type];
  const score = Math.round((entry.cat.compositeScore ?? 0) * 100);
  const isRsType = entry.type === "RS_ACCEL_EMERGING" || entry.type === "RS_DECEL_FADING";
  const isFlowType = entry.type === "FLOW_LEADS_SCORE" || entry.type === "FLOW_DISTRIBUTION";
  const rsAccelPts =
    isRsType && entry.cat.rs60 != null && entry.cat.rs120 != null
      ? Math.round((entry.cat.rs60 - entry.cat.rs120) * 100)
      : null;
  const flowZ = isFlowType && entry.cat.flow20d != null ? entry.cat.flow20d : null;
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
      ) : isFlowType && flowZ != null ? (
        <span
          className={`text-[10px] font-mono shrink-0 ${flowZ >= 1.5 ? "text-teal-400" : flowZ <= -0.8 ? "text-rose-400" : "text-slate-500"}`}
          title={`20-day dollar volume flow z-score: ${flowZ.toFixed(2)}σ`}
        >
          z={flowZ > 0 ? "+" : ""}{flowZ.toFixed(1)}σ
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
  const persistSignals: DivergenceEntry[] = [];
  const flowSignals: DivergenceEntry[] = [];

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

    if (cat.persistence20d != null && score != null) {
      if (cat.persistence20d >= 12 && score < 0.45) {
        persistSignals.push({ cat, type: "PERSIST_HIGH_SCORE_LOW" });
      } else if (cat.persistence20d < 7 && score >= 0.65) {
        persistSignals.push({ cat, type: "PERSIST_LOW_SCORE_HIGH" });
      }
    }

    if (cat.persistence5d != null && cat.persistence20d != null && cat.rs60 != null) {
      const rate5d = cat.persistence5d / 5;
      const prior15 = cat.persistence20d - cat.persistence5d;
      const rate15 = prior15 / 15;
      const velocityPct = Math.round((rate5d - rate15) * 100);
      if (velocityPct >= 10 && cat.rs60 <= 0.005 && (score ?? 1) < 0.55) {
        persistSignals.push({ cat, type: "VELOCITY_ACCEL_RS_LAGGING" });
      } else if (velocityPct <= -10 && cat.rs60 >= 0.01 && (score ?? 0) >= 0.55) {
        persistSignals.push({ cat, type: "VELOCITY_DECEL_RS_STRONG" });
      }
    }

    // Flow vs. score divergences
    if (cat.flow20d != null && score != null) {
      if (cat.flow20d >= 1.5 && score < 0.55) {
        flowSignals.push({ cat, type: "FLOW_LEADS_SCORE" });
      } else if (cat.flow20d <= -0.8 && score >= 0.65) {
        flowSignals.push({ cat, type: "FLOW_DISTRIBUTION" });
      }
    }
  }

  if (divergences.length === 0 && rsSignals.length === 0 && regimeSignals.length === 0 && persistSignals.length === 0 && flowSignals.length === 0) return null;

  const peaks    = divergences.filter(d => d.type === "SCORE_HIGH_RRG_WEAKENING");
  const recovers = divergences.filter(d => d.type === "SCORE_LOW_RRG_IMPROVING");
  const flowLeadsScore   = flowSignals.filter(d => d.type === "FLOW_LEADS_SCORE");
  const flowDistribution = flowSignals.filter(d => d.type === "FLOW_DISTRIBUTION");
  const hasFlowRow = flowLeadsScore.length > 0 || flowDistribution.length > 0;
  const accelEmerging = rsSignals.filter(d => d.type === "RS_ACCEL_EMERGING");
  const decelFading   = rsSignals.filter(d => d.type === "RS_DECEL_FADING");
  const regimeTailwind = regimeSignals.filter(d => d.type === "REGIME_TAILWIND_WEAK_SCORE");
  const regimeHeadwind = regimeSignals.filter(d => d.type === "REGIME_HEADWIND_STRONG_SCORE");
  const persistHighLow = persistSignals.filter(d => d.type === "PERSIST_HIGH_SCORE_LOW");
  const persistLowHigh = persistSignals.filter(d => d.type === "PERSIST_LOW_SCORE_HIGH");
  const velocityAccel  = persistSignals.filter(d => d.type === "VELOCITY_ACCEL_RS_LAGGING");
  const velocityDecel  = persistSignals.filter(d => d.type === "VELOCITY_DECEL_RS_STRONG");
  const hasRsRow = accelEmerging.length > 0 || decelFading.length > 0;
  const hasRegimeRow = regimeTailwind.length > 0 || regimeHeadwind.length > 0;
  const hasPersistRow = persistHighLow.length > 0 || persistLowHigh.length > 0;
  const hasVelocityRow = velocityAccel.length > 0 || velocityDecel.length > 0;

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

      {hasPersistRow && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-teal-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Persist ↑ Score Lagging</span>
              <span className="text-[10px] text-slate-600 ml-auto">≥12/20d beats benchmark</span>
            </div>
            {persistHighLow.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              persistHighLow.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>

          <div className="bg-slate-800/40 border border-yellow-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Persist ↓ Score Elevated</span>
              <span className="text-[10px] text-slate-600 ml-auto">&lt;7/20d beats benchmark</span>
            </div>
            {persistLowHigh.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              persistLowHigh.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>
        </div>
      )}

      {hasVelocityRow && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-emerald-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Breadth ⚡ RS Lagging</span>
              <span className="text-[10px] text-slate-600 ml-auto">velocity +10pp, RS ≈0</span>
            </div>
            {velocityAccel.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              velocityAccel.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>

          <div className="bg-slate-800/40 border border-orange-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Breadth ⬇ RS Elevated</span>
              <span className="text-[10px] text-slate-600 ml-auto">velocity −10pp, RS strong</span>
            </div>
            {velocityDecel.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              velocityDecel.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>
        </div>
      )}

      {hasFlowRow && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-800/40 border border-teal-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flow ↑ Score Lagging</span>
              <span className="text-[10px] text-slate-600 ml-auto">inflows z≥1.5σ, score &lt;55</span>
            </div>
            {flowLeadsScore.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              flowLeadsScore.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>

          <div className="bg-slate-800/40 border border-rose-800/30 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flow ↓ Score Elevated</span>
              <span className="text-[10px] text-slate-600 ml-auto">outflows z≤−0.8σ, score ≥65</span>
            </div>
            {flowDistribution.length === 0 ? (
              <p className="text-[11px] text-slate-600 py-2">None</p>
            ) : (
              flowDistribution.map(e => <DivergenceRow key={e.cat.id} entry={e} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

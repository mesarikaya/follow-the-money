import { CategorySummary } from "@/lib/api";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";

function StatCell({
  label,
  value,
  sub,
  valueClass = "text-slate-100",
  divider = true,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  valueClass?: string;
  divider?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 px-5 ${divider ? "border-r border-slate-700/60" : ""}`}>
      <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">{label}</span>
      <div className={`text-sm font-bold tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-600">{sub}</div>}
    </div>
  );
}

type Props = { categories: CategorySummary[] };

export default function MarketPulseStrip({ categories }: Props) {
  const equities = categories.filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null);
  if (equities.length < 3) return null;

  const getSignal = (c: CategorySummary): TradeSignal | null =>
    (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);

  const buyCount    = equities.filter(c => getSignal(c) === "BUY").length;
  const watchCount  = equities.filter(c => getSignal(c) === "WATCH").length;
  const holdCount   = equities.filter(c => getSignal(c) === "HOLD").length;
  const reduceCount = equities.filter(c => getSignal(c) === "REDUCE").length;

  const avgScore = Math.round(
    equities.reduce((s, c) => s + (c.compositeScore ?? 0), 0) / equities.length * 100
  );

  const rsAccelCount  = equities.filter(c => c.rs60 != null && c.rs120 != null && c.rs60 > c.rs120 + 0.001).length;
  const rsDecelCount  = equities.filter(c => c.rs60 != null && c.rs120 != null && c.rs60 < c.rs120 - 0.001).length;
  const rsHasData     = equities.some(c => c.rs60 != null && c.rs120 != null);

  const persistHigh  = equities.filter(c => (c.persistence20d ?? 0) >= 12).length;
  const persistLow   = equities.filter(c => c.persistence20d != null && c.persistence20d < 7).length;
  const hasPersist   = equities.some(c => c.persistence20d != null);

  const fullSignalCount = equities.filter(c =>
    c.compositeScore != null &&
    c.persistence20d != null &&
    c.macroFit != null &&
    c.rs60 != null
  ).length;
  const signalCompleteness = equities.length > 0 ? Math.round((fullSignalCount / equities.length) * 100) : 0;

  // Sectors entering approach zones (early warning signals)
  const approachingBuy    = equities.filter(c => (c.compositeScore ?? 0) >= 0.55 && (c.compositeScore ?? 0) < 0.65).length;
  const approachingReduce = equities.filter(c => (c.compositeScore ?? 0) >= 0.35 && (c.compositeScore ?? 0) <= 0.45).length;

  // Score momentum acceleration: sectors with 5d trend > 20d trend by ≥3 pts
  const accelCount = equities.filter(c =>
    c.compositeTrend5d != null && c.compositeTrend20d != null &&
    (c.compositeTrend5d - c.compositeTrend20d) >= 0.03
  ).length;
  const decelCount = equities.filter(c =>
    c.compositeTrend5d != null && c.compositeTrend20d != null &&
    (c.compositeTrend5d - c.compositeTrend20d) <= -0.03
  ).length;

  const scoreColor =
    avgScore >= 70 ? "text-emerald-400" :
    avgScore >= 40 ? "text-amber-400" :
    "text-red-400";

  const signalLabel =
    buyCount >= 3 ? "Strong Bull" :
    buyCount >= 1 || watchCount >= 4 ? "Cautious Bull" :
    reduceCount >= 3 ? "Bear" :
    "Neutral";
  const signalColor =
    buyCount >= 3 ? "text-emerald-400" :
    buyCount >= 1 || watchCount >= 4 ? "text-cyan-400" :
    reduceCount >= 3 ? "text-red-400" :
    "text-slate-400";

  const rsLabel = !rsHasData ? "—" :
    rsAccelCount > rsDecelCount ? `${rsAccelCount}↗ / ${rsDecelCount}↘` :
    `${rsDecelCount}↘ / ${rsAccelCount}↗`;
  const rsColor = !rsHasData ? "text-slate-500" :
    rsAccelCount > rsDecelCount ? "text-emerald-400" : "text-red-400";

  const persistLabel = !hasPersist ? "—" : `${persistHigh} strong`;
  const persistColor = !hasPersist ? "text-slate-500" :
    persistHigh > equities.length / 2 ? "text-emerald-400" :
    persistLow > equities.length / 2 ? "text-red-400" : "text-slate-400";

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center py-3 overflow-hidden">
      <StatCell
        label="Avg Score"
        value={avgScore}
        sub={`${equities.length} sectors`}
        valueClass={scoreColor}
      />
      <StatCell
        label="Market Bias"
        value={signalLabel}
        sub={`${buyCount}B · ${watchCount}W · ${holdCount}H · ${reduceCount}R`}
        valueClass={signalColor}
      />
      <StatCell
        label="RS Breadth"
        value={rsLabel}
        sub={rsHasData ? "accel vs decel" : undefined}
        valueClass={rsColor}
      />
      <StatCell
        label="Persistence"
        value={persistLabel}
        sub={hasPersist ? `${persistLow} low (<7d)` : undefined}
        valueClass={persistColor}
      />
      <StatCell
        label="Pipeline"
        value={approachingBuy > 0 || approachingReduce > 0 ? `${approachingBuy}↑ ${approachingReduce}↓` : "—"}
        sub={approachingBuy > 0 || approachingReduce > 0 ? "nearing BUY / REDUCE" : "no pre-signals"}
        valueClass={approachingBuy > 0 ? "text-cyan-400" : approachingReduce > 0 ? "text-amber-400" : "text-slate-500"}
      />
      <StatCell
        label="Momentum"
        value={accelCount > 0 || decelCount > 0 ? `${accelCount}↗ / ${decelCount}↘` : "—"}
        sub={accelCount > 0 || decelCount > 0 ? "score accel vs decel" : undefined}
        valueClass={accelCount > decelCount ? "text-emerald-400" : decelCount > accelCount ? "text-orange-400" : "text-slate-500"}
        divider={false}
      />
    </div>
  );
}

import { CategorySummary } from "@/lib/api";
import { deriveTradeSignal } from "@/lib/signals";
import Link from "next/link";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

type Regime = "RISK_ON" | "RISK_OFF" | "INFLECTION" | "NEUTRAL";

type RegimeConfig = {
  label: string;
  sub: string;
  barColor: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
};

const REGIME_CONFIG: Record<Regime, RegimeConfig> = {
  RISK_ON: {
    label: "RISK-ON",
    sub: "Broad strength — favour equity overweights",
    barColor: "bg-emerald-400",
    textColor: "text-emerald-300",
    bgColor: "bg-emerald-950/40",
    borderColor: "border-emerald-800/50",
    badgeColor: "bg-emerald-900/70 text-emerald-300 border-emerald-700/60",
  },
  RISK_OFF: {
    label: "RISK-OFF",
    sub: "Broad weakness — reduce exposure, raise cash",
    barColor: "bg-red-400",
    textColor: "text-red-300",
    bgColor: "bg-red-950/40",
    borderColor: "border-red-800/50",
    badgeColor: "bg-red-900/70 text-red-300 border-red-700/60",
  },
  INFLECTION: {
    label: "INFLECTION",
    sub: "Regime shifting — reduce size, monitor breakouts closely",
    barColor: "bg-amber-400",
    textColor: "text-amber-300",
    bgColor: "bg-amber-950/30",
    borderColor: "border-amber-800/40",
    badgeColor: "bg-amber-900/60 text-amber-300 border-amber-700/50",
  },
  NEUTRAL: {
    label: "NEUTRAL",
    sub: "Mixed signals — selective positioning only",
    barColor: "bg-slate-400",
    textColor: "text-slate-300",
    bgColor: "bg-slate-800/40",
    borderColor: "border-slate-700/40",
    badgeColor: "bg-slate-700/70 text-slate-300 border-slate-600/50",
  },
};

function computeRegime(
  equities: CategorySummary[],
  buyCount: number,
  reduceCount: number,
  watchCount: number,
): Regime {
  const n = equities.length || 1;
  const bullRatio = buyCount / n;
  const bearRatio = reduceCount / n;

  // Inflection: significant signals on BOTH sides at once
  if (buyCount >= 2 && reduceCount >= 2) return "INFLECTION";

  // Clear risk-on: many BUYs or BUY+WATCH majority
  if (buyCount >= 3 || (buyCount >= 2 && watchCount >= 4)) return "RISK_ON";
  if (bullRatio >= 0.3 && bearRatio < 0.1) return "RISK_ON";

  // Clear risk-off: multiple REDUCEs
  if (reduceCount >= 3) return "RISK_OFF";
  if (bearRatio >= 0.3 && bullRatio < 0.1) return "RISK_OFF";

  return "NEUTRAL";
}

type Props = { categories: CategorySummary[] };

export default function MarketRegimeBanner({ categories }: Props) {
  const equities = categories.filter(
    (c) => c.type === "EQUITY_SECTOR" && c.compositeScore != null,
  );
  if (equities.length < 3) return null;

  const signaled = equities.map((c) => ({
    ...c,
    _signal: (c.tradeSignal as string | null) ?? deriveTradeSignal(c) ?? "HOLD",
  }));

  const buyCount = signaled.filter((c) => c._signal === "BUY").length;
  const watchCount = signaled.filter((c) => c._signal === "WATCH").length;
  const holdCount = signaled.filter((c) => c._signal === "HOLD").length;
  const reduceCount = signaled.filter((c) => c._signal === "REDUCE").length;

  const regime = computeRegime(equities, buyCount, reduceCount, watchCount);
  const cfg = REGIME_CONFIG[regime];

  const avgScore = Math.round(
    (equities.reduce((s, c) => s + (c.compositeScore ?? 0), 0) / equities.length) * 100,
  );

  // High-conviction BUYs to call out
  const highConvBuys = signaled
    .filter(
      (c) =>
        c._signal === "BUY" &&
        (c.convictionScore ?? 0) >= 75 &&
        SECTOR_DRILLDOWN_IDS.has(c.id),
    )
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0))
    .slice(0, 3);

  const highConvReduces = signaled
    .filter(
      (c) =>
        c._signal === "REDUCE" &&
        (c.convictionScore ?? 0) >= 55 &&
        SECTOR_DRILLDOWN_IDS.has(c.id),
    )
    .sort((a, b) => (b.convictionScore ?? 0) - (a.convictionScore ?? 0))
    .slice(0, 2);

  // Signal distribution bar (proportional width segments)
  const n = equities.length;
  const pBuy    = (buyCount    / n) * 100;
  const pWatch  = (watchCount  / n) * 100;
  const pHold   = (holdCount   / n) * 100;
  const pReduce = (reduceCount / n) * 100;

  return (
    <div className={`rounded-xl border ${cfg.bgColor} ${cfg.borderColor} overflow-hidden`}>
      {/* Top accent line */}
      <div className={`h-0.5 w-full ${cfg.barColor}`} />

      <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
        {/* Regime label */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex flex-col">
            <span className={`text-xs font-black tracking-[0.15em] uppercase ${cfg.textColor}`}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">{cfg.sub}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-8 bg-slate-700/60 shrink-0" />

        {/* Signal distribution bar */}
        <div className="flex flex-col gap-1 shrink-0 min-w-[120px]">
          <div className="flex h-1.5 rounded-full overflow-hidden w-32 gap-px">
            {pBuy    > 0 && <div className="bg-emerald-500 rounded-full" style={{ width: `${pBuy}%` }} />}
            {pWatch  > 0 && <div className="bg-cyan-500 rounded-full"    style={{ width: `${pWatch}%` }} />}
            {pHold   > 0 && <div className="bg-slate-600 rounded-full"   style={{ width: `${pHold}%` }} />}
            {pReduce > 0 && <div className="bg-red-500 rounded-full"     style={{ width: `${pReduce}%` }} />}
          </div>
          <span className="text-[9px] text-slate-600 tabular-nums">
            {buyCount}B · {watchCount}W · {holdCount}H · {reduceCount}R
            <span className="ml-1.5">avg {avgScore}</span>
          </span>
        </div>

        {/* Divider */}
        {(highConvBuys.length > 0 || highConvReduces.length > 0) && (
          <div className="w-px h-8 bg-slate-700/60 shrink-0" />
        )}

        {/* High-conviction BUY tickers */}
        {highConvBuys.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-slate-600 uppercase tracking-widest shrink-0">Add</span>
            {highConvBuys.map((c) => (
              <Link
                key={c.id}
                href={`/sectors/${c.id}`}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold ${cfg.badgeColor} hover:opacity-80 transition-opacity`}
                title={`${c.etfTicker} — BUY · Conviction ${c.convictionScore}/100`}
              >
                {c.etfTicker}
                {c.convictionScore != null && (
                  <span className="text-[8px] opacity-70">C{c.convictionScore}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* High-conviction REDUCE tickers */}
        {highConvReduces.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[9px] text-slate-600 uppercase tracking-widest shrink-0">Trim</span>
            {highConvReduces.map((c) => (
              <Link
                key={c.id}
                href={`/sectors/${c.id}`}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono font-bold bg-red-900/60 text-red-300 border-red-700/50 hover:opacity-80 transition-opacity"
                title={`${c.etfTicker} — REDUCE · Conviction ${c.convictionScore}/100`}
              >
                {c.etfTicker}
                {c.convictionScore != null && (
                  <span className="text-[8px] opacity-70">C{c.convictionScore}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Regime score pill */}
        <div className="shrink-0 text-right">
          <span className="text-[9px] text-slate-600 block uppercase tracking-widest">breadth</span>
          <span className={`text-base font-black tabular-nums ${cfg.textColor}`}>
            {buyCount + watchCount}
            <span className="text-[10px] font-normal text-slate-600">/{n} bullish</span>
          </span>
        </div>
      </div>
    </div>
  );
}

import { Fragment } from "react";
import Link from "next/link";
import { CategorySummary, SubSectorSummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, TradeSignal } from "@/lib/signals";
import Sparkline from "@/components/Sparkline";
import GlossaryTooltip from "@/components/GlossaryTooltip";

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  EQUITY_SECTOR:  { label: "Equity",         className: "bg-blue-900/50 text-blue-300 border border-blue-800/40" },
  FIXED_INCOME:   { label: "Fixed Income",   className: "bg-purple-900/50 text-purple-300 border border-purple-800/40" },
  PRECIOUS_METAL: { label: "Precious Metal", className: "bg-yellow-900/50 text-yellow-300 border border-yellow-800/40" },
  CURRENCY:       { label: "Currency",       className: "bg-emerald-900/50 text-emerald-300 border border-emerald-800/40" },
  CASH:           { label: "Cash",           className: "bg-slate-700 text-slate-300 border border-slate-600" },
  ALTERNATIVE:    { label: "Alternative",    className: "bg-slate-700 text-slate-300 border border-slate-600" },
};

const TYPE_SECTION_LABELS: Record<string, string> = {
  PRECIOUS_METAL: "Precious Metals",
  FIXED_INCOME:   "Fixed Income",
  CASH:           "Cash",
};

const RRG_QUADRANT_CONFIG: Record<number, { label: string; color: string; borderClass: string }> = {
  4: { label: "↗ Leading",   color: "text-green-400",  borderClass: "border-l-green-500"  },
  3: { label: "↖ Improving", color: "text-cyan-400",   borderClass: "border-l-cyan-500"   },
  2: { label: "↘ Weakening", color: "text-orange-400", borderClass: "border-l-orange-500" },
  1: { label: "↙ Lagging",   color: "text-slate-400",  borderClass: "border-l-slate-600"  },
};

function TrendPip({
  trend,
  label,
}: {
  trend: number | null;
  label: string;
}) {
  if (trend == null) return null;
  const pts = Math.round(trend * 100);
  const abs = Math.abs(pts);
  if (abs < 1) return null;
  const color = pts > 0 ? "text-emerald-400" : "text-red-400";
  const arrow = pts > 0 ? "↑" : "↓";
  return (
    <span
      className={`text-[9px] tabular-nums ${color}`}
      title={`${label} composite score trend: ${pts > 0 ? "+" : ""}${pts} pts`}
    >
      {arrow}{abs}
    </span>
  );
}

function ScoreBar({
  score,
  trend5d,
  trend20d,
  macroFit,
}: {
  score: number | null;
  trend5d: number | null;
  trend20d: number | null;
  macroFit?: number | null;
}) {
  if (score == null) return <span className="text-slate-600 text-xs">—</span>;
  const pct = Math.round(score * 100);
  const filledCount = Math.round(score * 5);
  const barColor = score >= 0.7 ? "bg-green-500" : score >= 0.4 ? "bg-yellow-500" : "bg-red-500";
  const macroFitPct = macroFit != null ? Math.round(macroFit * 100) : null;
  const macroFitColor = macroFitPct != null ? (macroFitPct >= 60 ? "bg-violet-500" : macroFitPct >= 40 ? "bg-violet-400/60" : "bg-slate-600") : null;

  return (
    <div
      className="flex flex-col gap-0.5"
      title={`Composite signal score: ${pct}/100.${macroFitPct != null ? `\nMacro Fit: ${macroFitPct}% — historical win rate in current macro regime.` : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-3.5 rounded-[2px] ${i < filledCount ? barColor : "bg-slate-700"}`}
            />
          ))}
        </div>
        <span className={`text-xs tabular-nums font-medium ${score >= 0.7 ? "text-green-400" : score >= 0.4 ? "text-yellow-400" : "text-red-400"}`}>
          {pct}
        </span>
        <TrendPip trend={trend5d} label="5d" />
        <TrendPip trend={trend20d} label="20d" />
      </div>
      {macroFitPct != null && (
        <div className="flex items-center gap-1" title={`Macro Fit: ${macroFitPct}% — historical RS win rate in current regime`}>
          <div className="w-10 h-0.5 rounded-full bg-slate-700/60 overflow-hidden">
            <div className={`h-full rounded-full ${macroFitColor}`} style={{ width: `${macroFitPct}%` }} />
          </div>
          <span className="text-[9px] text-slate-600 tabular-nums">M{macroFitPct}%</span>
        </div>
      )}
    </div>
  );
}

const RS_LABEL: Record<string, string> = {
  DAY:     "20d",
  WEEK:    "20d",
  MONTH:   "60d",
  QUARTER: "120d",
  YEAR:    "120d",
};

function RsCell({ value, rs120, period }: { value: number | null; rs120?: number | null; period: string }) {
  if (value == null) return <span className="text-slate-600">—</span>;
  const pct = (value * 100).toFixed(1);
  const color = value > 0 ? "text-green-400" : value < 0 ? "text-red-400" : "text-slate-400";
  const accel = rs120 != null ? value - rs120 : null;
  const accelPts = accel != null ? Math.round(accel * 100) : null;
  const accelColor = accelPts != null && accelPts > 0 ? "text-emerald-400" : "text-red-400";
  const accelArrow = accelPts != null && accelPts > 0 ? "↗" : "↘";
  return (
    <span className="inline-flex items-center gap-1" title={`${period}-day relative strength vs benchmark. Positive = outperforming.${accelPts != null ? `\nAcceleration vs 120d: ${accelPts > 0 ? "+" : ""}${accelPts} pts` : ""}`}>
      <span className={`tabular-nums ${color}`}>{value > 0 ? "+" : ""}{pct}%</span>
      {accelPts != null && Math.abs(accelPts) >= 1 && (
        <span className={`text-[9px] tabular-nums ${accelColor}`}>{accelArrow}</span>
      )}
    </span>
  );
}

function buildScoreTooltip(cat: import("@/lib/api").CategorySummary, macroFitVal: number | null): string {
  const pct = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
  const rs60Str = cat.rs60 != null ? `${cat.rs60 > 0 ? "+" : ""}${(cat.rs60 * 100).toFixed(1)}%` : "—";
  const rs120Str = cat.rs120 != null ? `${cat.rs120 > 0 ? "+" : ""}${(cat.rs120 * 100).toFixed(1)}%` : "—";
  const rrgLabel = cat.rrgQuadrant ? ({ "4": "Leading ↗", "3": "Improving ↖", "2": "Weakening ↘", "1": "Lagging ↙" }[cat.rrgQuadrant] ?? "—") : "—";
  const macroFitStr = macroFitVal != null ? `${Math.round(macroFitVal * 100)}% win rate in current regime` : "—";
  const trend5dPts = cat.compositeTrend5d != null ? Math.round(cat.compositeTrend5d * 100) : null;
  const trend20dPts = cat.compositeTrend20d != null ? Math.round(cat.compositeTrend20d * 100) : null;
  return [
    `Composite Score: ${pct ?? "—"}/100`,
    ``,
    `RS-60 (25% weight): ${rs60Str}`,
    `RS-120 (10% weight, confirmation): ${rs120Str}`,
    `Flow 20d: n/a (AUM data unavailable)`,
    `Momentum (20% weight): ${trend5dPts != null ? `5d ${trend5dPts > 0 ? "+" : ""}${trend5dPts}pt` : "—"}`,
    `Macro Fit (10% weight): ${macroFitStr}`,
    `RRG (10% weight): ${rrgLabel}`,
    ``,
    trend20dPts != null ? `20d score trend: ${trend20dPts > 0 ? "+" : ""}${trend20dPts} pts` : "",
  ].filter(Boolean).join("\n");
}


const TRADE_SIGNAL_CONFIG: Record<TradeSignal, { label: string; className: string; description: string }> = {
  BUY:    { label: "BUY",    className: "bg-green-900/60 text-green-300 border-green-700/60",  description: "Score ≥65, improving RRG quadrant, positive 20d trend — all three aligned" },
  WATCH:  { label: "WATCH",  className: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50",     description: "Score ≥50, momentum or RRG improving — worth monitoring for entry" },
  HOLD:   { label: "HOLD",   className: "bg-slate-700/60 text-slate-400 border-slate-600/60",  description: "Mixed signals — maintain existing position, no strong directional bias" },
  REDUCE: { label: "REDUCE", className: "bg-red-900/50 text-red-400 border-red-700/50",        description: "Score <35 with weakening/lagging RRG — consider trimming exposure" },
};

function TradeSignalBadge({ cat }: { cat: CategorySummary }) {
  const signal = (cat.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(cat);
  if (signal == null) return <span className="text-slate-600 text-xs">—</span>;
  const cfg = TRADE_SIGNAL_CONFIG[signal];
  const score = cat.compositeScore ?? 0;
  const quadrant = cat.rrgQuadrant != null ? Number(cat.rrgQuadrant) : null;
  const trend20d = cat.compositeTrend20d;
  const scoreOk = score >= 0.65;
  const rrgOk = quadrant === 3 || quadrant === 4;
  const trendOk = trend20d != null && trend20d > 0;
  const conditionsMet = (scoreOk ? 1 : 0) + (rrgOk ? 1 : 0) + (trendOk ? 1 : 0);
  const showConditions = signal === "WATCH" || signal === "HOLD";
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.className}`}
        title={cfg.description}
      >
        {cfg.label}
      </span>
      {showConditions && conditionsMet > 0 && (
        <div
          className="flex gap-0.5 text-[8px]"
          title={`BUY needs all 3: Score≥65 ${scoreOk ? "✓" : "✗"} · RRG Improving/Leading ${rrgOk ? "✓" : "✗"} · 20d trend+ ${trendOk ? "✓" : "✗"}`}
        >
          <span className={scoreOk ? "text-emerald-400" : "text-slate-700"} title={`Score ${Math.round(score * 100)}/100 ${scoreOk ? "≥65 ✓" : "<65 ✗"}`}>S</span>
          <span className={rrgOk ? "text-emerald-400" : "text-slate-700"} title={`RRG ${rrgOk ? "Improving/Leading ✓" : "Weakening/Lagging ✗"}`}>R</span>
          <span className={trendOk ? "text-emerald-400" : "text-slate-700"} title={`20d trend ${trendOk ? "positive ✓" : "negative/null ✗"}`}>T</span>
        </div>
      )}
    </div>
  );
}

function TopSubChip({ sub }: { sub: SubSectorSummary }) {
  const rs = sub.rs60;
  const color = rs == null ? "text-slate-400" : rs > 0 ? "text-emerald-400" : "text-red-400";
  const rsPct = rs != null ? `${rs > 0 ? "+" : ""}${(rs * 100).toFixed(1)}%` : null;
  return (
    <span
      className="ml-1.5 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-mono bg-slate-700/60 border border-slate-600/50 text-slate-400"
      title={`Top sub-sector: ${sub.name} (${sub.etfTicker})${rsPct ? ` — RS-60 vs sector: ${rsPct}` : ""}`}
    >
      <span className="text-slate-500">▲</span>
      <span className="text-slate-300">{sub.etfTicker}</span>
      {rsPct && <span className={color}>{rsPct}</span>}
    </span>
  );
}

export default function CategoryTable({
  categories,
  timeframe = "MONTH",
  scoreHistory = {},
  macroFit = {},
  topSubSectors = {},
}: {
  categories: CategorySummary[];
  timeframe?: string;
  scoreHistory?: Record<string, number[]>;
  macroFit?: Record<string, number>;
  topSubSectors?: Record<string, SubSectorSummary>;
}) {
  const rsLabel = RS_LABEL[timeframe] ?? "60d";
  const hasHistory = Object.keys(scoreHistory).length > 0;
  const colSpan = hasHistory ? 9 : 8;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
            <th className="px-4 py-3 w-8">#</th>
            <th className="px-4 py-3">ETF</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3 text-right" title="Latest closing price">Close</th>
            {hasHistory && (
              <th className="px-3 py-3 text-center" title="30-day composite score trend (sparkline)">30d Trend</th>
            )}
            <th className="px-4 py-3 text-center"><GlossaryTooltip term="Composite Score">Score</GlossaryTooltip></th>
            <th className="px-4 py-3 text-right"><GlossaryTooltip term="RS-60">vs Benchmark ({rsLabel})</GlossaryTooltip></th>
            <th className="px-4 py-3 text-center"><GlossaryTooltip term="RRG">Signal</GlossaryTooltip> / <GlossaryTooltip term="BUY">Action</GlossaryTooltip></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {categories.map((cat, idx) => {
            const typeConfig = TYPE_CONFIG[cat.type] ?? TYPE_CONFIG.ALTERNATIVE;
            const prevType = idx > 0 ? categories[idx - 1].type : null;
            const showDivider = prevType !== cat.type && TYPE_SECTION_LABELS[cat.type] != null;
            const history = scoreHistory[cat.id] ?? [];
            const quadrantInfo = cat.rrgQuadrant != null ? RRG_QUADRANT_CONFIG[Number(cat.rrgQuadrant)] : null;
            const rowBorderClass = quadrantInfo ? quadrantInfo.borderClass : "border-l-slate-700/20";

            return (
              <Fragment key={cat.id}>
                {showDivider && (
                  <tr>
                    <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-semibold text-slate-500 bg-slate-900/60 uppercase tracking-widest border-t border-slate-700/60">
                      {TYPE_SECTION_LABELS[cat.type]}
                    </td>
                  </tr>
                )}
                <tr className={`hover:bg-slate-800/50 transition-colors text-slate-200 border-l-[3px] ${rowBorderClass}`}>
                  <td className="px-4 py-2.5 text-slate-500 tabular-nums text-xs">{cat.rank}</td>
                  <td className="px-4 py-2.5 font-mono text-blue-300 font-medium">
                    <div className="flex items-center flex-wrap gap-x-0.5">
                      {SECTOR_DRILLDOWN_IDS.has(cat.id) ? (
                        <Link href={`/sectors/${cat.id}`} className="hover:text-cyan-300 transition-colors underline decoration-blue-700/50 hover:decoration-cyan-400/70">
                          {cat.etfTicker}
                        </Link>
                      ) : cat.etfTicker}
                      {SECTOR_DRILLDOWN_IDS.has(cat.id) && topSubSectors[cat.id] && (
                        <TopSubChip sub={topSubSectors[cat.id]} />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-medium">
                    {SECTOR_DRILLDOWN_IDS.has(cat.id) ? (
                      <Link href={`/sectors/${cat.id}`} className="hover:text-cyan-300 transition-colors">
                        {cat.name}
                      </Link>
                    ) : cat.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeConfig.className}`}>
                      {typeConfig.label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                    {cat.latestClose != null ? `$${Number(cat.latestClose).toFixed(2)}` : "—"}
                  </td>
                  {hasHistory && (
                    <td className="px-3 py-2.5">
                      <div className="flex justify-center">
                        <Sparkline values={history} />
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5" title={buildScoreTooltip(cat, macroFit[cat.id] ?? null)}>
                    <div className="flex justify-center">
                      <ScoreBar score={cat.compositeScore} trend5d={cat.compositeTrend5d} trend20d={cat.compositeTrend20d} macroFit={macroFit[cat.id] ?? null} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <RsCell value={cat.rs60} rs120={cat.rs120} period={rsLabel.replace("d", "")} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      {quadrantInfo ? (
                        <span className={`text-xs ${quadrantInfo.color}`}>{quadrantInfo.label}</span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                      <TradeSignalBadge cat={cat} />
                    </div>
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>

      <div className="px-4 py-2.5 border-t border-slate-700 flex items-center gap-4 text-xs text-slate-500 bg-slate-800/40 flex-wrap">
        {(["EQUITY_SECTOR", "PRECIOUS_METAL", "FIXED_INCOME", "CASH"] as const).map((type) => (
          <span key={type} className="flex items-center gap-1.5">
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${TYPE_CONFIG[type].className}`}>
              {TYPE_CONFIG[type].label}
            </span>
          </span>
        ))}
        <span className="ml-auto" title="Score bars: 5 cells = 0-100 composite signal score. S/R/T = BUY conditions: Score≥65, RRG Improving/Leading, 20d trend positive">
          Score: ██████ = strong · ███ = moderate · █ = weak · S/R/T = BUY conditions
        </span>
      </div>
    </div>
  );
}

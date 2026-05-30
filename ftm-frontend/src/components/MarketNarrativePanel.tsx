"use client";

import Link from "next/link";
import { CategorySummary, MacroResponse, SubSectorSummary } from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";
import { deriveTradeSignal, countBuyConditions, missingBuyConditions, TradeSignal } from "@/lib/signals";
import GlossaryTooltip from "@/components/GlossaryTooltip";

const REGIME_LABELS: Record<string, string> = {
  RISK_ON:         "Risk-On",
  RISK_OFF:        "Risk-Off",
  LATE_CYCLE:      "Late Cycle",
  EARLY_RECOVERY:  "Early Recovery",
  TRANSITIONAL:    "Transitional",
};


function buildNarrative(
  equities: CategorySummary[],
  macro: MacroResponse | null,
  topSubSectors: Record<string, SubSectorSummary>,
): string[] {
  const lines: string[] = [];

  const getSignal = (c: CategorySummary) => (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);
  const buySignals = equities.filter(c => getSignal(c) === "BUY");
  const reduceSignals = equities.filter(c => getSignal(c) === "REDUCE");
  const nearBuySignals = equities.filter(c =>
    getSignal(c) === "WATCH" && countBuyConditions(c) === 2
  );
  const bullishCount = equities.filter(c => (c.compositeScore ?? 0) >= 0.7).length;
  const bearishCount = equities.filter(c => (c.compositeScore ?? 0) < 0.4).length;
  const accelCount = equities.filter(c =>
    c.rs60 != null && c.rs120 != null && c.rs60 > c.rs120 + 0.005
  ).length;

  // Regime sentence
  if (macro?.regime) {
    const label = REGIME_LABELS[macro.regime] ?? macro.regime;
    lines.push(`Current macro regime is **${label}**.`);
  }

  // Market breadth sentence
  if (bullishCount >= equities.length * 0.6) {
    lines.push(`Broad strength: ${bullishCount} of ${equities.length} equity sectors score above 70 — a risk-on breadth signal.`);
  } else if (bearishCount >= equities.length * 0.5) {
    lines.push(`Defensive posture warranted: ${bearishCount} of ${equities.length} equity sectors are weak (score <40).`);
  } else {
    lines.push(`Market breadth is mixed: ${bullishCount} strong, ${bearishCount} weak sectors out of ${equities.length}.`);
  }

  // RS momentum breadth
  if (accelCount >= 6) {
    lines.push(`RS momentum is broadening — ${accelCount} sectors show accelerating relative strength vs the past.`);
  } else if (accelCount <= 3 && equities.length > 0) {
    lines.push(`RS momentum is narrowing — only ${accelCount} sectors are accelerating relative to the benchmark.`);
  }

  // BUY signals
  if (buySignals.length > 0) {
    const names = buySignals
      .map(c => {
        const sub = topSubSectors[c.id];
        const subPart = sub ? ` (→ ${sub.etfTicker})` : "";
        return `${c.etfTicker}${subPart}`;
      })
      .join(", ");
    lines.push(`**Add / Overweight:** ${names} — all three signals aligned (score, RRG quadrant, trend).`);
  } else {
    lines.push(`No sectors currently meet all three BUY criteria simultaneously.`);
  }

  // Near-BUY sectors (2 of 3 conditions met)
  if (nearBuySignals.length > 0) {
    const nearBuyStr = nearBuySignals
      .slice(0, 3)
      .map(c => `${c.etfTicker} (missing: ${missingBuyConditions(c).join(", ")})`)
      .join("; ");
    lines.push(`**Watch closely:** ${nearBuyStr} — 2 of 3 BUY conditions met, one confirmation away.`);
  }

  // REDUCE signals
  if (reduceSignals.length > 0) {
    const names = reduceSignals.map(c => c.etfTicker).join(", ");
    lines.push(`**Trim / Avoid:** ${names} — weak score with deteriorating momentum.`);
  }

  // Top sub-sector callout
  const leadingSubs = equities
    .filter(c => SECTOR_DRILLDOWN_IDS.has(c.id) && topSubSectors[c.id]?.rs60 != null)
    .map(c => ({ parent: c, sub: topSubSectors[c.id] }))
    .sort((a, b) => (b.sub.rs60 ?? 0) - (a.sub.rs60 ?? 0))
    .slice(0, 2);

  if (leadingSubs.length > 0) {
    const subStrs = leadingSubs.map(({ parent, sub }) => {
      const rsPct = sub.rs60 != null ? `+${(sub.rs60 * 100).toFixed(1)}%` : "";
      return `${sub.etfTicker} within ${parent.etfTicker} (${rsPct} RS vs sector)`;
    }).join("; ");
    lines.push(`**Rotation leadership within sectors:** ${subStrs}.`);
  }

  return lines;
}

type Props = {
  categories: CategorySummary[];
  macro: MacroResponse | null;
  topSubSectors?: Record<string, SubSectorSummary>;
};

export default function MarketNarrativePanel({ categories, macro, topSubSectors = {} }: Props) {
  const equities = categories
    .filter(c => c.type === "EQUITY_SECTOR" && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (equities.length < 3) return null;

  const narrative = buildNarrative(equities, macro, topSubSectors);
  const getSignal = (c: CategorySummary) => (c.tradeSignal as TradeSignal | null) ?? deriveTradeSignal(c);
  const buySignals = equities.filter(c => getSignal(c) === "BUY");

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Market Narrative</span>
          <span className="text-[10px] text-slate-600">auto-generated · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
        </div>
        {buySignals.length > 0 && (
          <span className="text-[10px] font-semibold text-green-400 bg-green-900/30 border border-green-800/40 px-2 py-0.5 rounded">
            {buySignals.length} BUY signal{buySignals.length > 1 ? "s" : ""} active
          </span>
        )}
      </div>

      <div className="px-4 py-3 space-y-2">
        {narrative.map((line, i) => {
          // Parse **bold** markers
          const parts = line.split(/\*\*(.+?)\*\*/g);
          return (
            <p key={i} className="text-xs text-slate-300 leading-relaxed">
              {parts.map((part, j) =>
                j % 2 === 1
                  ? <strong key={j} className="text-slate-100 font-semibold">{part}</strong>
                  : <span key={j}>{part}</span>
              )}
            </p>
          );
        })}
      </div>

      {buySignals.length > 0 && (
        <div className="px-4 pb-3 pt-0 flex items-center gap-2 flex-wrap">
          {buySignals.map(cat => (
            <Link
              key={cat.id}
              href={`/sectors/${cat.id}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-green-900/30 border border-green-700/50 text-green-300 text-[11px] font-mono font-bold hover:border-green-500/70 transition-colors"
              title={`Drill into ${cat.name}`}
            >
              {cat.etfTicker} →
            </Link>
          ))}
          <span className="text-[10px] text-slate-600 ml-1">click to drill into sector sub-groups</span>
        </div>
      )}

      <div className="px-4 pb-2.5 pt-0 flex flex-wrap gap-x-3 gap-y-0.5">
        <span className="text-[9px] text-slate-700">
          <GlossaryTooltip term="Composite Score">Score</GlossaryTooltip>
          {" · "}
          <GlossaryTooltip term="RS-60">RS-60</GlossaryTooltip>
          {" · "}
          <GlossaryTooltip term="RRG">RRG</GlossaryTooltip>
          {" · "}
          <GlossaryTooltip term="Macro Fit">Macro Fit</GlossaryTooltip>
          {" · "}
          <GlossaryTooltip term="BUY">BUY</GlossaryTooltip>
          {" · "}
          <GlossaryTooltip term="REDUCE">REDUCE</GlossaryTooltip>
          {" — click any term for definition · not financial advice"}
        </span>
      </div>
    </div>
  );
}

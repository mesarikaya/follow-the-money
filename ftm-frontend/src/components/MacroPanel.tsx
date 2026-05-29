import { MacroResponse, MacroIndicators } from "@/lib/api";

const REGIME_COLORS: Record<string, string> = {
  RISK_ON_GROWTH:     "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  RISK_ON_DEFENSIVE:  "bg-blue-900/50 text-blue-300 border-blue-700",
  RISK_OFF_DEFENSIVE: "bg-orange-900/50 text-orange-300 border-orange-700",
  RISK_OFF_FLIGHT:    "bg-red-900/50 text-red-300 border-red-700",
  STAGFLATION:        "bg-amber-900/50 text-amber-300 border-amber-700",
};

type RegimeImplication = {
  headline: string;
  favor: string[];
  avoid: string[];
};

const REGIME_IMPLICATIONS: Record<string, RegimeImplication> = {
  RISK_ON_GROWTH: {
    headline: "Economy expanding, volatility low — growth assets leading.",
    favor: ["Tech (XLK)", "Consumer Disc. (XLY)", "Industrials (XLI)", "Financials (XLF)"],
    avoid: ["Long bonds (TLT)", "Utilities (XLU)", "Gold (GLD)"],
  },
  RISK_ON_DEFENSIVE: {
    headline: "Growth moderating but still positive — quality and stability favored.",
    favor: ["Healthcare (XLV)", "Consumer Staples (XLP)", "Financials (XLF)"],
    avoid: ["High-beta tech sub-sectors", "Speculative small-caps"],
  },
  RISK_OFF_DEFENSIVE: {
    headline: "Rising uncertainty — capital rotating to safer assets.",
    favor: ["Healthcare (XLV)", "Staples (XLP)", "Gold (GLD)", "Short bonds (BIL)"],
    avoid: ["Discretionary (XLY)", "Tech growth names", "Energy (XLE)"],
  },
  RISK_OFF_FLIGHT: {
    headline: "Stress conditions — flight to safety, equities broadly under pressure.",
    favor: ["Cash (BIL)", "Gold (GLD)", "Long bonds (TLT)", "Utilities (XLU)"],
    avoid: ["Most equity sectors", "High-yield bonds (HYG)"],
  },
  STAGFLATION: {
    headline: "High inflation + slowing growth — real assets and energy outperform.",
    favor: ["Energy (XLE)", "Materials (XLB)", "Gold (GLD)", "Commodities (DBC)"],
    avoid: ["Long-duration bonds (TLT)", "High-multiple tech growth"],
  },
};

type CardConfig = {
  label: string;
  key: keyof MacroIndicators;
  format: (v: number | null) => string;
  tooltip: string;
  lowerIsBetter?: boolean;
};

const CARD_CONFIGS: CardConfig[] = [
  {
    label: "VIX",
    key: "vix",
    format: v => v == null ? "—" : v.toFixed(1),
    tooltip: "CBOE Volatility Index — fear gauge. <20 = calm, >30 = stress",
    lowerIsBetter: true,
  },
  {
    label: "10Y–2Y Spread",
    key: "yieldSpread10y2y",
    format: v => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
    tooltip: "10Y minus 2Y Treasury yield spread. Positive = normal curve, negative = inversion (recession signal)",
  },
  {
    label: "10Y Yield",
    key: "tenYearYield",
    format: v => v == null ? "—" : `${v.toFixed(2)}%`,
    tooltip: "US 10-year Treasury yield (FRED DGS10)",
  },
  {
    label: "2Y Yield",
    key: "twoYearYield",
    format: v => v == null ? "—" : `${v.toFixed(2)}%`,
    tooltip: "US 2-year Treasury yield (FRED DGS2)",
  },
  {
    label: "Breakeven Infl.",
    key: "breakevenInflation",
    format: v => v == null ? "—" : `${v.toFixed(2)}%`,
    tooltip: "10Y breakeven inflation rate (T10YIE) — market's inflation expectation",
  },
  {
    label: "Fed Funds Rate",
    key: "fedFundsRate",
    format: v => v == null ? "—" : `${v.toFixed(2)}%`,
    tooltip: "Effective Federal Funds Rate (FEDFUNDS)",
  },
  {
    label: "USD Index",
    key: "usdIndex",
    format: v => v == null ? "—" : v.toFixed(1),
    tooltip: "Trade-weighted US Dollar index (DTWEXBGS). Rising = USD strengthening",
  },
  {
    label: "WTI Crude",
    key: "wtiCrudeOilPrice",
    format: v => v == null ? "—" : `$${v.toFixed(1)}`,
    tooltip: "WTI crude oil spot price (USD/bbl). Rising = inflationary pressure on energy costs",
  },
];

function trendArrow(
  current: number | null,
  previous: number | null,
  lowerIsBetter = false
): { arrow: string; colorClass: string; deltaStr: string } | null {
  if (current == null || previous == null) return null;
  const delta = current - previous;
  const threshold = Math.abs(previous) * 0.002;
  if (Math.abs(delta) <= threshold) {
    return { arrow: "→", colorClass: "text-slate-500", deltaStr: "" };
  }
  const up = delta > 0;
  const improving = lowerIsBetter ? !up : up;
  return {
    arrow: up ? "↑" : "↓",
    colorClass: improving ? "text-emerald-400" : "text-red-400",
    deltaStr: `${up ? "+" : ""}${delta.toFixed(2)}`,
  };
}

function MacroCard({
  config,
  value,
  previousValue,
}: {
  config: CardConfig;
  value: number | null;
  previousValue: number | null;
}) {
  const trend = trendArrow(value, previousValue, config.lowerIsBetter);
  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3"
      title={config.tooltip}
    >
      <div className="text-xs text-slate-500 mb-1">{config.label}</div>
      <div className="text-lg font-semibold tabular-nums text-slate-100 leading-tight">
        {config.format(value)}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 text-[11px] mt-0.5 ${trend.colorClass}`}>
          <span>{trend.arrow}</span>
          {trend.deltaStr && <span className="tabular-nums">{trend.deltaStr}</span>}
        </div>
      )}
    </div>
  );
}

export default function MacroPanel({ macro }: { macro: MacroResponse }) {
  const { indicators, previousIndicators, regime, asOfDate } = macro;
  const regimeClass = REGIME_COLORS[regime] ?? "bg-slate-700 text-slate-300 border-slate-600";
  const implication = REGIME_IMPLICATIONS[regime] ?? null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold text-slate-200">Macro Environment</h2>
        <span className={`inline-block px-2.5 py-0.5 rounded border text-xs font-medium ${regimeClass}`}>
          {regime.replace(/_/g, " ")}
        </span>
        {asOfDate && (
          <span className="text-xs text-slate-500">as of {asOfDate}</span>
        )}
      </div>

      {implication && (
        <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 text-xs space-y-2">
          <p className="text-slate-300">{implication.headline}</p>
          <div className="flex gap-6">
            <div>
              <span className="text-emerald-400 font-semibold">Favor: </span>
              <span className="text-slate-400">{implication.favor.join(" · ")}</span>
            </div>
            <div>
              <span className="text-red-400 font-semibold">Avoid: </span>
              <span className="text-slate-400">{implication.avoid.join(" · ")}</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
        {CARD_CONFIGS.map((config) => (
          <MacroCard
            key={config.key}
            config={config}
            value={indicators[config.key] ?? null}
            previousValue={previousIndicators?.[config.key] ?? null}
          />
        ))}
      </div>
    </section>
  );
}

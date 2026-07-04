import { MacroResponse, MacroIndicators } from "@/lib/api";

type SignalReading = {
  label: string;
  colorClass: string;
  barPct: number;
};

function interpretIndicator(key: keyof MacroIndicators, value: number | null): SignalReading | null {
  if (value == null) return null;
  switch (key) {
    case "vix": {
      if (value < 15) return { label: "Calm", colorClass: "text-emerald-400", barPct: 15 };
      if (value < 20) return { label: "Low Fear", colorClass: "text-emerald-300", barPct: 30 };
      if (value < 25) return { label: "Elevated", colorClass: "text-amber-400", barPct: 55 };
      if (value < 30) return { label: "High Fear", colorClass: "text-orange-400", barPct: 70 };
      return { label: "Panic", colorClass: "text-red-400", barPct: 90 };
    }
    case "yieldSpread10y2y": {
      if (value > 1.0) return { label: "Steep Curve", colorClass: "text-emerald-400", barPct: 85 };
      if (value > 0.5) return { label: "Normal", colorClass: "text-emerald-300", barPct: 65 };
      if (value > 0.0) return { label: "Flattening", colorClass: "text-amber-400", barPct: 45 };
      if (value > -0.5) return { label: "Inverted", colorClass: "text-orange-400", barPct: 25 };
      return { label: "Deep Inversion", colorClass: "text-red-400", barPct: 10 };
    }
    case "tenYearYield": {
      if (value < 3.5) return { label: "Accommodative", colorClass: "text-emerald-400", barPct: 25 };
      if (value < 4.5) return { label: "Neutral", colorClass: "text-slate-400", barPct: 50 };
      if (value < 5.5) return { label: "Restrictive", colorClass: "text-amber-400", barPct: 70 };
      return { label: "Very High", colorClass: "text-red-400", barPct: 90 };
    }
    case "twoYearYield": {
      if (value < 3.5) return { label: "Low", colorClass: "text-emerald-400", barPct: 25 };
      if (value < 4.5) return { label: "Moderate", colorClass: "text-slate-400", barPct: 50 };
      if (value < 5.5) return { label: "High", colorClass: "text-amber-400", barPct: 75 };
      return { label: "Very High", colorClass: "text-red-400", barPct: 90 };
    }
    case "breakevenInflation": {
      if (value < 1.5) return { label: "Deflation Risk", colorClass: "text-blue-400", barPct: 10 };
      if (value < 2.0) return { label: "Below Target", colorClass: "text-slate-400", barPct: 35 };
      if (value < 2.5) return { label: "On Target", colorClass: "text-emerald-400", barPct: 55 };
      if (value < 3.0) return { label: "Above Target", colorClass: "text-amber-400", barPct: 75 };
      return { label: "High Inflation", colorClass: "text-red-400", barPct: 90 };
    }
    case "fedFundsRate": {
      if (value < 2.0) return { label: "Accommodative", colorClass: "text-emerald-400", barPct: 20 };
      if (value < 3.5) return { label: "Neutral", colorClass: "text-slate-400", barPct: 45 };
      if (value < 5.0) return { label: "Restrictive", colorClass: "text-amber-400", barPct: 70 };
      return { label: "Very Tight", colorClass: "text-red-400", barPct: 90 };
    }
    case "usdIndex": {
      if (value < 95) return { label: "Weak USD", colorClass: "text-emerald-400", barPct: 25 };
      if (value < 103) return { label: "Neutral", colorClass: "text-slate-400", barPct: 50 };
      if (value < 110) return { label: "Strong USD", colorClass: "text-amber-400", barPct: 70 };
      return { label: "Very Strong", colorClass: "text-orange-400", barPct: 88 };
    }
    case "wtiCrudeOilPrice": {
      if (value < 50) return { label: "Low", colorClass: "text-emerald-400", barPct: 20 };
      if (value < 75) return { label: "Moderate", colorClass: "text-slate-400", barPct: 45 };
      if (value < 95) return { label: "Elevated", colorClass: "text-amber-400", barPct: 70 };
      return { label: "High — Inflationary", colorClass: "text-red-400", barPct: 88 };
    }
    default:
      return null;
  }
}

const REGIME_BAR: Record<string, string> = {
  RISK_ON_GROWTH:    "bg-emerald-600",
  RISK_ON_DEFENSIVE: "bg-blue-600",
  RISK_OFF_FLIGHT:   "bg-red-700",
  STAGFLATION:       "bg-amber-600",
};

const REGIME_SHORT: Record<string, string> = {
  RISK_ON_GROWTH:    "Growth",
  RISK_ON_DEFENSIVE: "Defensive",
  RISK_OFF_FLIGHT:   "Risk-Off",
  STAGFLATION:       "Stagflation",
};

function fmtDate(iso: string): string {
  const parts = iso.slice(0, 10).split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
}

function RegimeTimeline({ history }: { history: { date: string; regime: string }[] }) {
  if (!history || history.length < 5) return null;
  type Segment = { regime: string; start: string; end: string; count: number };
  const segments: Segment[] = [];
  for (const entry of history) {
    const last = segments[segments.length - 1];
    if (last && last.regime === entry.regime) {
      last.end = entry.date;
      last.count++;
    } else {
      segments.push({ regime: entry.regime, start: entry.date, end: entry.date, count: 1 });
    }
  }
  const total = history.length;
  const startDate = fmtDate(history[0].date);
  const endDate = fmtDate(history[history.length - 1].date);
  const regimesPresent = [...new Set(segments.map(s => s.regime))];
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Regime History</span>
        <span className="text-[9px] text-slate-600">{startDate} → {endDate} · {total}d</span>
      </div>
      <div className="flex h-2.5 rounded-full overflow-hidden gap-px">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${REGIME_BAR[seg.regime] ?? "bg-slate-600"}`}
            style={{ width: `${(seg.count / total) * 100}%`, minWidth: "2px" }}
            title={`${REGIME_SHORT[seg.regime] ?? seg.regime}: ${fmtDate(seg.start)} → ${fmtDate(seg.end)} (${seg.count}d)`}
          />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {regimesPresent.map(regime => (
          <span key={regime} className="flex items-center gap-1.5 text-[9px] text-slate-400">
            <span className={`w-2 h-2 rounded-sm ${REGIME_BAR[regime] ?? "bg-slate-600"}`} />
            {REGIME_SHORT[regime] ?? regime}
            <span className="text-slate-600">
              ({segments.filter(s => s.regime === regime).reduce((sum, s) => sum + s.count, 0)}d)
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

const REGIME_COLORS: Record<string, string> = {
  RISK_ON_GROWTH:    "bg-emerald-900/50 text-emerald-300 border-emerald-700",
  RISK_ON_DEFENSIVE: "bg-blue-900/50 text-blue-300 border-blue-700",
  RISK_OFF_FLIGHT:   "bg-red-900/50 text-red-300 border-red-700",
  STAGFLATION:       "bg-amber-900/50 text-amber-300 border-amber-700",
};

type RegimeImplication = {
  headline: string;
  favor: string[];
  avoid: string[];
};

const REGIME_IMPLICATIONS: Record<string, RegimeImplication> = {
  RISK_ON_GROWTH: {
    headline: "Economy expanding, volatility low — growth assets leading.",
    favor: ["Tech (XLK)", "Consumer Disc. (XLY)", "Industrials (XLI / EXV6.DE)", "Financials (XLF / EXV1.DE)"],
    avoid: ["Long-duration bonds (TLT / IEGA)", "Utilities (XLU)", "Gold (GLD / SGLD.DE)"],
  },
  RISK_ON_DEFENSIVE: {
    headline: "Growth moderating but still positive — quality and stability favored.",
    favor: ["Healthcare (XLV / EXV4.DE)", "Consumer Staples (XLP)", "Financials (XLF / EXV1.DE)"],
    avoid: ["High-beta tech sub-sectors", "Speculative small-caps"],
  },
  RISK_OFF_FLIGHT: {
    headline: "Stress conditions — flight to safety, equities broadly under pressure.",
    favor: ["Cash / short-term govt bonds (BIL / XEON.DE)", "Gold (GLD / SGLD.DE)", "Eurozone govt bonds (IEGA) or US Treasuries (TLT — note: USD currency risk for EUR investors)", "Utilities (XLU)"],
    avoid: ["Most equity sectors", "High-yield bonds (HYG)"],
  },
  STAGFLATION: {
    headline: "High inflation + slowing growth — real assets and energy outperform.",
    favor: ["Energy (XLE)", "Materials (XLB)", "Gold (GLD / SGLD.DE)", "Commodities (DBC)"],
    avoid: ["Long-duration bonds (TLT / IEGA) — especially with USD debasement risk", "High-multiple tech growth"],
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
  const reading = interpretIndicator(config.key, value);
  return (
    <div
      className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 space-y-1.5"
      title={config.tooltip}
    >
      <div className="text-xs text-slate-500">{config.label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-slate-100 leading-tight">
          {config.format(value)}
        </span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-[11px] ${trend.colorClass}`}>
            <span>{trend.arrow}</span>
            {trend.deltaStr && <span className="tabular-nums">{trend.deltaStr}</span>}
          </span>
        )}
      </div>
      {reading && (
        <div className="space-y-1">
          <span className={`text-[10px] font-medium ${reading.colorClass}`}>{reading.label}</span>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${reading.colorClass.replace("text-", "bg-")}`}
              style={{ width: `${reading.barPct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function MacroPanel({ macro }: { macro: MacroResponse }) {
  const { indicators, previousIndicators, regime, asOfDate, regimeHistory } = macro;
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

      <RegimeTimeline history={regimeHistory ?? []} />

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

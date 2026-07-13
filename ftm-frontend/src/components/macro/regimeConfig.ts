import { MacroIndicators } from "@/lib/api";

/** The four macro regimes and how each one looks, reads and trades. */

export const REGIME_STYLES: Record<string, { label: string; color: string; ring: string; bg: string }> = {
  RISK_ON_GROWTH:    { label: "Risk On — Growth",    color: "text-emerald-300", ring: "border-emerald-600", bg: "bg-emerald-900/30" },
  RISK_ON_DEFENSIVE: { label: "Risk On — Defensive", color: "text-blue-300",    ring: "border-blue-600",    bg: "bg-blue-900/30"    },
  RISK_OFF_FLIGHT:   { label: "Risk Off — Flight",   color: "text-red-300",     ring: "border-red-600",     bg: "bg-red-900/30"     },
  STAGFLATION:       { label: "Stagflation",          color: "text-amber-300",   ring: "border-amber-600",   bg: "bg-amber-900/30"   },
};

export const REGIME_DESCRIPTIONS: Record<string, string> = {
  RISK_ON_GROWTH:    "Spread positive, VIX low, inflation contained. Equities and cyclicals favored.",
  RISK_ON_DEFENSIVE: "Spread narrow or flat, VIX moderate. Rotate toward quality and dividend sectors.",
  RISK_OFF_FLIGHT:   "Spread deeply inverted, VIX spiking, USD surging. Gold and Treasuries lead.",
  STAGFLATION:       "Inflation above 3%, breakeven rising, growth slowing. Commodities and energy.",
};

export const REGIME_PLAYBOOK: Record<string, { leaders: string[]; laggards: string[]; note: string }> = {
  RISK_ON_GROWTH: {
    leaders:  ["Technology (XLK)", "Consumer Discretionary (XLY)", "Industrials (XLI)", "Financials (XLF)", "Momentum (MTUM)"],
    laggards: ["Utilities (XLU)", "Consumer Staples (XLP)", "Gold (GLD)", "Long Bonds (TLT)", "Low Volatility (USMV)"],
    note: "Classic bull market rotation. Cyclicals and growth lead; defensives and safe-havens lag.",
  },
  RISK_ON_DEFENSIVE: {
    leaders:  ["Healthcare (XLV)", "Financials (XLF)", "Quality (QUAL)", "Consumer Staples (XLP)", "Dividend payers"],
    laggards: ["Speculative growth tech", "High-beta small caps", "Momentum (MTUM)", "Crypto proxies"],
    note: "Late-cycle risk-on: prefer quality over momentum. Watch for spread narrowing as a regime shift signal.",
  },
  RISK_OFF_FLIGHT: {
    leaders:  ["Gold (GLD)", "Long Treasuries (TLT)", "USD (UUP)", "Low Volatility (USMV)", "Utilities (XLU)"],
    laggards: ["All equities (broad)", "High-yield bonds (HYG)", "Emerging markets (EEM)", "Energy (XLE)", "Financials (XLF)"],
    note: "Crisis mode: VIX > 30, yield curve deeply inverted. Gold and short-duration Treasuries are the only safe harbors.",
  },
  STAGFLATION: {
    leaders:  ["Energy (XLE)", "Materials (XLB)", "Gold (GLD)", "Commodities (DJP)", "Value (VLUE)"],
    laggards: ["Growth tech (XLK)", "Consumer Discretionary (XLY)", "Long Bonds (TLT)", "REITs (XLRE)", "Momentum (MTUM)"],
    note: "Inflation > 3% with slowing growth. Real assets and commodity producers outperform; duration and growth suffer.",
  },
};

export type IndicatorConfig = {
  label: string;
  series: string;
  format: (v: number | null) => string;
  tooltip: string;
  lowerIsBetter?: boolean;
};

export const INDICATOR_LABELS: Record<keyof MacroIndicators, IndicatorConfig> = {
  vix:                { label: "VIX",                series: "VIXCLS",     format: v => v == null ? "—" : v.toFixed(2),        tooltip: "CBOE Volatility Index — market fear gauge. <20 = calm, >30 = stress", lowerIsBetter: true },
  tenYearYield:       { label: "10Y Yield",           series: "DGS10",      format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "US 10-year Treasury yield (FRED DGS10)" },
  twoYearYield:       { label: "2Y Yield",            series: "DGS2",       format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "US 2-year Treasury yield (FRED DGS2)" },
  yieldSpread10y2y:   { label: "10Y–2Y Spread",      series: "T10Y2Y",     format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "10Y minus 2Y Treasury spread. Negative = inverted yield curve = recession signal" },
  breakevenInflation: { label: "Breakeven Inflation", series: "T10YIE",     format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "10Y breakeven inflation rate (FRED T10YIE) — market's inflation expectation" },
  fedFundsRate:       { label: "Fed Funds Rate",      series: "FEDFUNDS",   format: v => v == null ? "—" : `${v.toFixed(2)}%`, tooltip: "Effective Federal Funds Rate (FRED FEDFUNDS)" },
  usdIndex:           { label: "USD Index",           series: "DTWEXBGS",   format: v => v == null ? "—" : v.toFixed(2),        tooltip: "US Dollar Index — DXY proxy. Rising = USD strengthening" },
  wtiCrudeOilPrice:   { label: "WTI Crude Oil",       series: "DCOILWTICO", format: v => v == null ? "—" : `$${v.toFixed(2)}`, tooltip: "WTI crude oil price USD/barrel (FRED DCOILWTICO). Key cross-asset inflation signal" },
};

export const REGIME_BAR_COLOR: Record<string, string> = {
  RISK_ON_GROWTH:    "bg-green-600",
  RISK_ON_DEFENSIVE: "bg-blue-600",
  RISK_OFF_FLIGHT:   "bg-red-600",
  STAGFLATION:       "bg-amber-500",
};

export const SIGNAL_STYLES: Record<string, { className: string }> = {
  BUY:    { className: "bg-green-900/60 text-green-300 border-green-700/60" },
  WATCH:  { className: "bg-cyan-900/50 text-cyan-300 border-cyan-700/50" },
  HOLD:   { className: "bg-slate-700/60 text-slate-400 border-slate-600/60" },
  REDUCE: { className: "bg-red-900/50 text-red-400 border-red-700/50" },
};

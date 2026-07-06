import { TradeSignal } from "@/lib/signals";

/** Tailwind classes for each trade-signal badge — shared by the portfolio page and its sections. */
export const SIGNAL_CONFIG: Record<TradeSignal, { className: string }> = {
  BUY:    { className: "bg-green-500/20 text-green-300 border border-green-500/40" },
  WATCH:  { className: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" },
  HOLD:   { className: "bg-slate-600/30 text-slate-400 border border-slate-500/30" },
  REDUCE: { className: "bg-red-500/15 text-red-400 border border-red-500/30" },
};

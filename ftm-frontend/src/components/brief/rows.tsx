import Link from "next/link";
import { AlertDto, CategorySummary, ThemeSummary } from "@/lib/api";

/** The rows and pills of the daily brief. */

export const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  RISK_ON_GROWTH:    { label: "Risk On — Growth",    color: "text-emerald-300", bg: "bg-emerald-900/25", border: "border-emerald-700/50" },
  RISK_ON_DEFENSIVE: { label: "Risk On — Defensive", color: "text-blue-300",    bg: "bg-blue-900/25",    border: "border-blue-700/50"    },
  RISK_OFF_FLIGHT:   { label: "Risk Off — Flight",   color: "text-red-300",     bg: "bg-red-900/25",     border: "border-red-700/50"     },
  STAGFLATION:       { label: "Stagflation",          color: "text-amber-300",   bg: "bg-amber-900/25",   border: "border-amber-700/50"   },
};

const SIGNAL_CONFIG: Record<string, { color: string; bg: string }> = {
  BUY:    { color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30"       },
  HOLD:   { color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40"     },
  REDUCE: { color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30"         },
};

const SEVERITY_DOT: Record<string, string> = {
  URGENT:  "bg-red-400",
  ACTION:  "bg-orange-400",
  WARNING: "bg-amber-400",
  INFO:    "bg-slate-500",
};

const PHASE_LABEL: Record<string, string> = {
  BREAKOUT:  "↗ BREAKOUT",
  MOMENTUM:  "↑ MOMENTUM",
  SETUP:     "⬆ SETUP",
  BUILDING:  "→ BUILDING",
  FADING:    "↓ FADING",
  DISTRIBUTE:"↘ DIST",
  WEAK:      "↓ WEAK",
  HOLDING:   "■ HOLDING",
};

export function fmt(v: number | null, decimals = 2, suffix = ""): string {
  if (v == null) return "—";
  return `${v.toFixed(decimals)}${suffix}`;
}

function scoreColor(s: number | null): string {
  if (s == null) return "text-slate-500";
  if (s >= 0.65) return "text-emerald-400";
  if (s >= 0.50) return "text-cyan-400";
  if (s >= 0.35) return "text-amber-400";
  return "text-red-400";
}

export function ScorePill({ score }: { score: number | null }) {
  const pct = score != null ? Math.round(score * 100) : null;
  const color = scoreColor(score);
  return <span className={`text-[13px] font-bold font-mono tabular-nums ${color}`}>{pct ?? "—"}</span>;
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || Math.abs(delta) < 0.005) return null;
  const pts = Math.round(delta * 100);
  const up = pts > 0;
  return (
    <span className={`text-[10px] font-mono tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? "+" : ""}{pts}pt
    </span>
  );
}

export function CategoryRow({ cat, scoreHistory5d }: { cat: CategorySummary; scoreHistory5d: number | null }) {
  const sig = SIGNAL_CONFIG[cat.tradeSignal ?? "HOLD"] ?? SIGNAL_CONFIG.HOLD;
  const delta5d = scoreHistory5d != null && cat.compositeScore != null ? cat.compositeScore - scoreHistory5d : null;
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800/60 last:border-0">
      <Link href={`/?timeframe=MONTH`} className="w-10 text-[11px] font-mono text-slate-400 shrink-0 hover:text-slate-200 transition-colors">
        {cat.etfTicker}
      </Link>
      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sig.bg} ${sig.color} shrink-0 w-12 text-center`}>
        {cat.tradeSignal ?? "HOLD"}
      </span>
      <ScorePill score={cat.compositeScore} />
      <DeltaBadge delta={delta5d} />
      {cat.rrgQuadrant != null && (
        <span className="text-[9px] font-mono text-slate-600 ml-auto shrink-0">Q{cat.rrgQuadrant}</span>
      )}
      <span className="text-[11px] text-slate-300 flex-1 truncate ml-1">{cat.name}</span>
    </div>
  );
}

export function AlertSummaryRow({ alert }: { alert: AlertDto }) {
  const dot = SEVERITY_DOT[alert.severity] ?? SEVERITY_DOT.INFO;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-1">{alert.message}</p>
        <p className="text-[9px] font-mono text-slate-600 mt-0.5">
          {alert.themeId ? (
            <Link href={`/themes/${alert.themeId}`} className="hover:text-slate-400 transition-colors">{alert.themeId}</Link>
          ) : alert.categoryId ?? "—"}
        </p>
      </div>
      <span className="text-[9px] font-mono text-slate-700 shrink-0 mt-0.5">
        {new Date(alert.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
      </span>
    </div>
  );
}

export function ThemePill({ theme }: { theme: ThemeSummary }) {
  const sig = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
  const pct = theme.compositeScore != null ? Math.round(theme.compositeScore * 100) : null;
  const phase = theme.themePhase ? PHASE_LABEL[theme.themePhase] ?? theme.themePhase : null;
  return (
    <Link href={`/themes/${theme.id}`} className="block bg-slate-800/70 border border-slate-700/60 rounded-lg p-3 hover:border-slate-500/80 transition-all group">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[11px] font-semibold text-slate-200 group-hover:text-white transition-colors leading-tight">
          {theme.name}
        </span>
        <span className={`text-[13px] font-bold font-mono tabular-nums shrink-0 ${scoreColor(theme.compositeScore)}`}>
          {pct ?? "—"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sig.bg} ${sig.color}`}>
          {theme.dominantSignal}
        </span>
        {phase && (
          <span className="text-[9px] font-mono text-slate-500">{phase}</span>
        )}
        {theme.compositeTrend5d != null && Math.abs(theme.compositeTrend5d) > 0.003 && (
          <span className={`text-[9px] font-mono ${theme.compositeTrend5d > 0 ? "text-emerald-500" : "text-red-500"}`}>
            {theme.compositeTrend5d > 0 ? "↑" : "↓"}
          </span>
        )}
      </div>
    </Link>
  );
}

export function MoverRow({ cat, delta, direction }: { cat: CategorySummary; delta: number; direction: "up" | "down" }) {
  const pts = Math.round(delta * 100);
  const score = cat.compositeScore != null ? Math.round(cat.compositeScore * 100) : null;
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-slate-800/60 last:border-0">
      <span className={`text-[10px] font-mono font-bold ${direction === "up" ? "text-emerald-400" : "text-red-400"}`}>
        {direction === "up" ? "▲" : "▼"} {direction === "up" ? "+" : ""}{pts}pt
      </span>
      <span className="text-[11px] text-slate-300 flex-1 truncate">{cat.name}</span>
      <span className="text-[10px] font-mono text-slate-500 shrink-0">{cat.etfTicker}</span>
      {score != null && (
        <span className={`text-[10px] font-mono tabular-nums shrink-0 ${scoreColor(cat.compositeScore)}`}>{score}</span>
      )}
    </div>
  );
}

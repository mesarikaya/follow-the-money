import Link from "next/link";
import { fetchCategories, fetchMacro, fetchAlerts, fetchThemes, fetchPortfolioSnapshots, CategorySummary, AlertDto, ThemeSummary, PortfolioSnapshot } from "@/lib/api";

export const dynamic = "force-dynamic";

const REGIME_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
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

function fmt(v: number | null, decimals = 2, suffix = ""): string {
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

function ScorePill({ score }: { score: number | null }) {
  const pct = score != null ? Math.round(score * 100) : null;
  const color = scoreColor(score);
  return <span className={`text-[13px] font-bold font-mono tabular-nums ${color}`}>{pct ?? "—"}</span>;
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null || Math.abs(delta) < 0.005) return null;
  const pts = Math.round(delta * 100);
  const up = pts > 0;
  return (
    <span className={`text-[10px] font-mono tabular-nums ${up ? "text-emerald-400" : "text-red-400"}`}>
      {up ? "+" : ""}{pts}pt
    </span>
  );
}

function CategoryRow({ cat, scoreHistory5d }: { cat: CategorySummary; scoreHistory5d: number | null }) {
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

function AlertSummaryRow({ alert }: { alert: AlertDto }) {
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

function ThemePill({ theme }: { theme: ThemeSummary }) {
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

function MoverRow({ cat, delta, direction }: { cat: CategorySummary; delta: number; direction: "up" | "down" }) {
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

export default async function BriefPage() {
  const [categoriesResult, macroResult, alertsResult, themesResult, snapshotsResult] = await Promise.allSettled([
    fetchCategories("MONTH"),
    fetchMacro(),
    fetchAlerts(),
    fetchThemes(),
    fetchPortfolioSnapshots(7),
  ]);

  const categories: CategorySummary[] =
    categoriesResult.status === "fulfilled" ? categoriesResult.value.categories.filter(c => c.parentId == null) : [];
  const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
  const alerts: AlertDto[] =
    alertsResult.status === "fulfilled"
      ? alertsResult.value.alerts.filter(a => a.status === "ACTIVE").slice(0, 8)
      : [];
  const themes: ThemeSummary[] =
    themesResult.status === "fulfilled"
      ? [...themesResult.value].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1))
      : [];
  const snapshots: PortfolioSnapshot[] =
    snapshotsResult.status === "fulfilled" ? snapshotsResult.value : [];
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const prevSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const portfolioDayChange =
    latestSnapshot && prevSnapshot
      ? ((latestSnapshot.totalValueEur - prevSnapshot.totalValueEur) / prevSnapshot.totalValueEur) * 100
      : null;

  const regime = macro?.regime ?? null;
  const regimeCfg = regime ? (REGIME_CONFIG[regime] ?? null) : null;

  // Top BUY candidates: EQUITY_SECTOR or COMMODITY with BUY signal, sorted by score
  const buys = [...categories]
    .filter(c => c.tradeSignal === "BUY" && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 5);

  // Exit/reduce candidates
  const exits = [...categories]
    .filter(c => (c.tradeSignal === "REDUCE" || (c.tradeSignal === "HOLD" && (c.compositeScore ?? 1) < 0.35)) && c.compositeScore != null)
    .sort((a, b) => (a.compositeScore ?? 1) - (b.compositeScore ?? 1))
    .slice(0, 5);

  // Watch / building
  const watches = [...categories]
    .filter(c => c.tradeSignal === "WATCH" && c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0))
    .slice(0, 4);

  // Biggest movers 5d — need to use trend data as proxy (compositeTrend5d)
  const withTrend = categories.filter(c => c.compositeTrend5d != null && c.compositeScore != null);
  const risingFast = [...withTrend]
    .sort((a, b) => (b.compositeTrend5d ?? 0) - (a.compositeTrend5d ?? 0))
    .slice(0, 3)
    .map(c => ({ cat: c, delta: (c.compositeTrend5d ?? 0) * 5 }))
    .filter(x => x.delta > 0.01);
  const fallingFast = [...withTrend]
    .sort((a, b) => (a.compositeTrend5d ?? 0) - (b.compositeTrend5d ?? 0))
    .slice(0, 3)
    .map(c => ({ cat: c, delta: (c.compositeTrend5d ?? 0) * 5 }))
    .filter(x => x.delta < -0.01);

  const today = new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  const actionCount = alerts.filter(a => a.severity === "ACTION" || a.severity === "URGENT").length;
  const warningCount = alerts.filter(a => a.severity === "WARNING").length;
  const infoCount = alerts.filter(a => a.severity === "INFO").length;

  return (
    <div className="flex flex-col h-full overflow-auto">
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-rajdhani)" }}>
              Daily Brief
            </h1>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">{today} · institutional rotation snapshot</p>
          </div>
          {regimeCfg && regime && (
            <div className={`px-3 py-2 rounded-lg border ${regimeCfg.bg} ${regimeCfg.border}`}>
              <div className={`text-[11px] font-semibold ${regimeCfg.color}`}>{regimeCfg.label}</div>
              {macro?.indicators && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] font-mono text-slate-500">
                    VIX <span className="text-slate-300">{fmt(macro.indicators.vix)}</span>
                  </span>
                  {macro.indicators.yieldSpread10y2y != null && (
                    <span className="text-[10px] font-mono text-slate-500">
                      Spread{" "}
                      <span className={macro.indicators.yieldSpread10y2y < 0 ? "text-red-300" : "text-slate-300"}>
                        {macro.indicators.yieldSpread10y2y > 0 ? "+" : ""}
                        {fmt(macro.indicators.yieldSpread10y2y, 2, "%")}
                      </span>
                    </span>
                  )}
                  {macro.indicators.wtiCrudeOilPrice != null && (
                    <span className="text-[10px] font-mono text-slate-500">
                      WTI <span className="text-slate-300">${fmt(macro.indicators.wtiCrudeOilPrice, 1)}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Portfolio pulse strip */}
        {latestSnapshot && (
          <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">Portfolio</span>
            <Link href="/portfolio" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-sm font-mono font-semibold text-emerald-400">
                €{latestSnapshot.totalValueEur.toLocaleString("de-DE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
              {portfolioDayChange != null && (
                <span className={`text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                  portfolioDayChange >= 0
                    ? "text-emerald-400 bg-emerald-950/40"
                    : "text-red-400 bg-red-950/40"
                }`}>
                  {portfolioDayChange >= 0 ? "+" : ""}{portfolioDayChange.toFixed(2)}% 1d
                </span>
              )}
              <span className="text-[10px] text-slate-600">{latestSnapshot.holdingCount} holdings</span>
            </Link>
            {latestSnapshot.totalCostEur && latestSnapshot.totalCostEur > 0 && (() => {
              const unrealizedPct = ((latestSnapshot.totalValueEur - latestSnapshot.totalCostEur) / latestSnapshot.totalCostEur) * 100;
              const isPos = unrealizedPct >= 0;
              return (
                <span className={`ml-auto text-[10px] font-mono ${isPos ? "text-emerald-500" : "text-red-500"}`}
                  title="Unrealized P&L vs cost basis">
                  {isPos ? "+" : ""}{unrealizedPct.toFixed(1)}% total
                </span>
              );
            })()}
          </div>
        )}

        {/* Alert counts strip */}
        {alerts.length > 0 && (
          <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-700/50 rounded-lg px-4 py-2.5">
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">Active Alerts</span>
            <div className="flex items-center gap-3 flex-wrap">
              {actionCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-orange-300">{actionCount} Action</span>
                </div>
              )}
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-amber-300">{warningCount} Warning</span>
                </div>
              )}
              {infoCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-500 shrink-0" />
                  <span className="text-[11px] text-slate-400">{infoCount} Info</span>
                </div>
              )}
            </div>
            <Link href="/alerts" className="ml-auto text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors shrink-0">
              all alerts →
            </Link>
          </div>
        )}

        {/* 3-column signal grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* BUY */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">Buy</span>
              <span className="text-[10px] font-mono text-slate-600 ml-auto">{buys.length}</span>
            </div>
            <div className="px-3 py-1">
              {buys.length > 0 ? (
                buys.map(c => <CategoryRow key={c.id} cat={c} scoreHistory5d={null} />)
              ) : (
                <p className="text-[11px] text-slate-600 py-3 text-center">No BUY signals</p>
              )}
            </div>
          </div>

          {/* WATCH */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">Watch</span>
              <span className="text-[10px] font-mono text-slate-600 ml-auto">{watches.length}</span>
            </div>
            <div className="px-3 py-1">
              {watches.length > 0 ? (
                watches.map(c => <CategoryRow key={c.id} cat={c} scoreHistory5d={null} />)
              ) : (
                <p className="text-[11px] text-slate-600 py-3 text-center">No WATCH signals</p>
              )}
            </div>
          </div>

          {/* EXIT/REDUCE */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider font-semibold">Reduce / Exit</span>
              <span className="text-[10px] font-mono text-slate-600 ml-auto">{exits.length}</span>
            </div>
            <div className="px-3 py-1">
              {exits.length > 0 ? (
                exits.map(c => <CategoryRow key={c.id} cat={c} scoreHistory5d={null} />)
              ) : (
                <p className="text-[11px] text-slate-600 py-3 text-center">No REDUCE signals</p>
              )}
            </div>
          </div>
        </div>

        {/* Movers strip */}
        {(risingFast.length > 0 || fallingFast.length > 0) && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/30">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">5-Day Score Movers</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
              <div className="px-3 py-1">
                {risingFast.length > 0 ? (
                  risingFast.map(({ cat, delta }) => <MoverRow key={cat.id} cat={cat} delta={delta} direction="up" />)
                ) : (
                  <p className="text-[11px] text-slate-600 py-2">No significant risers</p>
                )}
              </div>
              <div className="px-3 py-1">
                {fallingFast.length > 0 ? (
                  fallingFast.map(({ cat, delta }) => <MoverRow key={cat.id} cat={cat} delta={Math.abs(delta)} direction="down" />)
                ) : (
                  <p className="text-[11px] text-slate-600 py-2">No significant fallers</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Themes grid */}
        {themes.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Themes</span>
              <Link href="/themes" className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
                all themes →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {themes.slice(0, 8).map(t => <ThemePill key={t.id} theme={t} />)}
            </div>
          </div>
        )}

        {/* Active alerts detail */}
        {alerts.length > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/30 flex items-center justify-between">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Alert Log</span>
              <Link href="/alerts" className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors">manage →</Link>
            </div>
            <div className="px-3 py-1">
              {alerts.slice(0, 6).map(a => <AlertSummaryRow key={a.id} alert={a} />)}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

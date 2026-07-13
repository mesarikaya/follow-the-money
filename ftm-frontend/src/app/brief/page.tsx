import Link from "next/link";
import {
  AlertDto,
  CategorySummary,
  PortfolioSnapshot,
  ThemeSummary,
  fetchAlerts,
  fetchCategories,
  fetchMacro,
  fetchPortfolioSnapshots,
  fetchThemes,
} from "@/lib/api";
import {
  countAlerts,
  fallingFast,
  portfolioDayChangePct,
  risingFast,
  topBuys,
  topExits,
  topWatches,
} from "@/lib/brief/briefSelections";
import {
  AlertSummaryRow,
  CategoryRow,
  MoverRow,
  REGIME_CONFIG,
  ThemePill,
  fmt,
} from "@/components/brief/rows";

export const dynamic = "force-dynamic";

const SNAPSHOT_DAYS = 7;
const MAX_ALERTS = 8;

export default async function BriefPage() {
  const [categoriesResult, macroResult, alertsResult, themesResult, snapshotsResult] =
    await Promise.allSettled([
      fetchCategories("MONTH"),
      fetchMacro(),
      fetchAlerts(),
      fetchThemes(),
      fetchPortfolioSnapshots(SNAPSHOT_DAYS),
    ]);

  // Only top-level categories — the brief is a summary, not a drilldown.
  const categories: CategorySummary[] =
    categoriesResult.status === "fulfilled"
      ? categoriesResult.value.categories.filter(category => category.parentId == null)
      : [];
  const macro = macroResult.status === "fulfilled" ? macroResult.value : null;
  const alerts: AlertDto[] =
    alertsResult.status === "fulfilled"
      ? alertsResult.value.alerts.filter(alert => alert.status === "ACTIVE").slice(0, MAX_ALERTS)
      : [];
  const themes: ThemeSummary[] =
    themesResult.status === "fulfilled"
      ? [...themesResult.value].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1))
      : [];
  const snapshots: PortfolioSnapshot[] =
    snapshotsResult.status === "fulfilled" ? snapshotsResult.value : [];

  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const portfolioDayChange = portfolioDayChangePct(snapshots);

  const regime = macro?.regime ?? null;
  const regimeCfg = regime ? REGIME_CONFIG[regime] ?? null : null;

  const buys = topBuys(categories);
  const exits = topExits(categories);
  const watches = topWatches(categories);
  const risers = risingFast(categories);
  const fallers = fallingFast(categories);
  const { action: actionCount, warning: warningCount, info: infoCount } = countAlerts(alerts);

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
        {(risers.length > 0 || fallers.length > 0) && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-700/30">
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">5-Day Score Movers</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
              <div className="px-3 py-1">
                {risers.length > 0 ? (
                  risers.map(({ cat, delta }) => <MoverRow key={cat.id} cat={cat} delta={delta} direction="up" />)
                ) : (
                  <p className="text-[11px] text-slate-600 py-2">No significant risers</p>
                )}
              </div>
              <div className="px-3 py-1">
                {fallers.length > 0 ? (
                  fallers.map(({ cat, delta }) => <MoverRow key={cat.id} cat={cat} delta={Math.abs(delta)} direction="down" />)
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

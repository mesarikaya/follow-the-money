import { fetchThemes, fetchThemeHistory, fetchAlerts, fetchRecentAlerts, fetchRotationScore, AlertDto, ThemeHistoryPoint } from "@/lib/api";
import { ThemePlaybook, PreBuySetupPanel, ThemeTippingPoints, TopOpportunitiesPanel, ThemeNarrative } from "@/components/themes/panels";
import { ThemeScreener, type ViewPreset, type ScreenerParams } from "@/components/themes/screener";
import { ThemeCard, ThemeScoreHeatmap, ThemeRaceChart } from "@/components/themes/overview";
import { ThemeRelativeStrengthPlot, ThemePositioningMatrix, ThemeRiskMatrixPanel, ThemeEntryAdvisorPanel, CapitalRotationPanel, MomentumDivergencePanel } from "@/components/themes/panels";
import { ActiveRotationBanner, RotationMomentumStrip, ThemeEventsFeed, ThemeAlertFeed } from "@/components/themes/panels";
import ThemeAlertRiskMap from "@/components/ThemeAlertRiskMap";
import ThemeBuyCountdown from "@/components/ThemeBuyCountdown";
import ThemeScoreZPanel from "@/components/ThemeScoreZPanel";
import ThemeSignalStreakPanel from "@/components/ThemeSignalStreakPanel";


































































export default async function ThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; signal?: string; phase?: string; entry?: string; confidence?: string; view?: string }>;
}) {
  const { sort: sortParam, signal: signalFilter, phase: phaseFilter, entry: entryFilter, confidence: confidenceFilter, view: viewParam } = await searchParams;
  const screenerSort = ["score", "delta5d", "alerts", "rs60", "velocity", "percentile", "confluence", "persistence", "iqs"].includes(sortParam ?? "") ? sortParam as string : "score";
  const view: ViewPreset = viewParam === "essential" ? "essential" : viewParam === "full" ? "full" : "standard";
  const allParams: ScreenerParams = {
    sort: sortParam,
    signal: signalFilter,
    phase: phaseFilter,
    entry: entryFilter,
    confidence: confidenceFilter,
    view: view === "standard" ? undefined : view,
  };

  const [themes, alertsResponse, recentAlerts, rotationData] = await Promise.all([
    fetchThemes(),
    fetchAlerts().catch(() => ({ activeCount: 0, alerts: [] })),
    fetchRecentAlerts().catch(() => [] as AlertDto[]),
    fetchRotationScore().catch(() => null),
  ]);

  const historyResults = await Promise.allSettled(
    themes.map(t => fetchThemeHistory(t.id, 30))
  );
  const historyByThemeId: Record<string, ThemeHistoryPoint[]> = {};
  themes.forEach((t, i) => {
    const result = historyResults[i];
    historyByThemeId[t.id] = result.status === "fulfilled" ? result.value : [];
  });

  const themeAlerts = alertsResponse.alerts.filter(a => a.themeId != null && a.status === "ACTIVE");
  const alertsByThemeId: Record<string, number> = {};
  for (const alert of themeAlerts) {
    if (alert.themeId) alertsByThemeId[alert.themeId] = (alertsByThemeId[alert.themeId] ?? 0) + 1;
  }

  const filteredThemes = themes.filter(t => {
    if (signalFilter && t.dominantSignal !== signalFilter) return false;
    if (phaseFilter && t.themePhase !== phaseFilter) return false;
    if (entryFilter && t.entryAction !== entryFilter) return false;
    if (confidenceFilter && t.confidenceLabel !== confidenceFilter) return false;
    return true;
  });

  const buyThemes = themes.filter(t => t.dominantSignal === "BUY").length;
  const watchThemes = themes.filter(t => t.dominantSignal === "WATCH").length;
  const activeThemes = themes.filter(t => t.dominantSignal === "BUY" || t.dominantSignal === "WATCH").length;

  const phaseGroups: { phase: string; count: number; cls: string }[] = [
    { phase: "BREAKOUT", count: themes.filter(t => t.themePhase === "BREAKOUT").length,  cls: "text-emerald-400" },
    { phase: "MOMENTUM", count: themes.filter(t => t.themePhase === "MOMENTUM").length,  cls: "text-cyan-400" },
    { phase: "SETUP",    count: themes.filter(t => t.themePhase === "SETUP").length,     cls: "text-sky-400" },
    { phase: "FADING",   count: themes.filter(t => t.themePhase === "FADING").length,    cls: "text-amber-400" },
    { phase: "WEAK",     count: themes.filter(t => t.themePhase === "WEAK").length,      cls: "text-red-400" },
  ].filter(g => g.count > 0);

  const sortedByScore = [...themes].sort(
    (a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1)
  );

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
            Investment Themes
          </h1>
          <p className="text-slate-400 text-sm">
            Cross-sector capital flow narratives — each theme aggregates signals across constituent ETFs to surface conviction before the mainstream narrative. Sparklines show 30-day composite trend.
          </p>
          {themes.length > 0 && (
            <div className="flex gap-3 mt-2 flex-wrap">
              {buyThemes > 0 && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                  {buyThemes} BUY
                </span>
              )}
              {watchThemes > 0 && (
                <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                  {watchThemes} WATCH
                </span>
              )}
              {themeAlerts.length > 0 && (
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                  {themeAlerts.length} alert{themeAlerts.length !== 1 ? "s" : ""}
                </span>
              )}
              {activeThemes === 0 && (
                <span className="text-[11px] font-mono text-slate-500">No active signals</span>
              )}
              {phaseGroups.length > 0 && (
                <span className="text-[11px] font-mono text-slate-400">
                  {phaseGroups.map((g, i) => (
                    <span key={g.phase}>
                      {i > 0 && <span className="text-slate-600"> · </span>}
                      <span className={g.cls}>{g.count} {g.phase}</span>
                    </span>
                  ))}
                </span>
              )}
              <span className="text-[11px] font-mono text-slate-600">
                {themes.length} themes · {themes.reduce((a, t) => a + t.constituentCount, 0)} ETFs tracked
              </span>
            </div>
          )}
        </div>

        {themes.length > 0 && <TopOpportunitiesPanel themes={themes} />}
        {themeAlerts.length > 0 && <ThemeAlertFeed alerts={themeAlerts} themes={themes} />}
        {recentAlerts.length > 0 && <ThemeEventsFeed events={recentAlerts} />}
        {themes.length > 0 && <ThemeTippingPoints themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <ThemePlaybook themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <PreBuySetupPanel themes={themes} />}
        {themes.length > 1 && <ThemeRiskMatrixPanel themes={themes} />}
        {rotationData && <CapitalRotationPanel data={rotationData} />}
        {themes.length > 0 && <ThemeEntryAdvisorPanel themes={themes} />}
        {themes.length > 0 && <MomentumDivergencePanel themes={themes} />}
        {themes.length > 0 && <ThemeNarrative themes={themes} />}
        {themes.length > 0 && <ActiveRotationBanner themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 0 && <ThemeBuyCountdown themes={themes} />}
        {themes.length > 1 && Object.keys(historyByThemeId).length > 0 && (
          <ThemeScoreZPanel themes={themes} historiesByThemeId={historyByThemeId} />
        )}
        {themes.length > 1 && Object.keys(historyByThemeId).length > 0 && (
          <ThemeSignalStreakPanel themes={themes} historiesByThemeId={historyByThemeId} />
        )}
        {themes.length > 0 && <RotationMomentumStrip themes={themes} />}
        {themes.length > 1 && <ThemeRelativeStrengthPlot themes={themes} />}
        {themes.length > 1 && <ThemePositioningMatrix themes={themes} />}
        {themes.length > 1 && <ThemeRaceChart themes={themes} historiesByThemeId={historyByThemeId} />}
        {themes.length > 1 && <ThemeAlertRiskMap themes={themes} />}
        {themes.length > 0 && <ThemeScreener themes={filteredThemes} allThemes={themes} historiesByThemeId={historyByThemeId} alertsByThemeId={alertsByThemeId} sort={screenerSort} allParams={allParams} view={view} />}
        {themes.length > 1 && <ThemeScoreHeatmap themes={themes} historiesByThemeId={historyByThemeId} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {sortedByScore.map(theme => (
            <ThemeCard key={theme.id} theme={theme} history={historyByThemeId[theme.id] ?? []} />
          ))}
        </div>

        {themes.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-12">
            No themes available — run ingestion to populate signals.
          </div>
        )}
      </div>
    </main>
  );
}

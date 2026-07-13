import Link from "next/link";
import { fetchThemes, fetchThemeHistory, fetchAlerts, fetchRecentAlerts, fetchRotationScore, AlertDto, ThemeSummary, ThemeHistoryPoint } from "@/lib/api";
import { scoreColor, signalAgeDays, phaseAgeDays, getThemeUniqueSectors, themeShortLabel } from "@/lib/themes/themeMetrics";
import { SIGNAL_CONFIG, ScoreArc, FlowChip, TrendChip, EtfBubble, DivergenceChip, ThemeSparkline, ScoreDeltaBadge, ThemePhaseBadge, PhaseTransitionBadge, RiskLevelBadge, MomentumAlignmentBadge, EntryActionBadge, ConfluenceBadge, SignalFreshnessBadge, BullishBar } from "@/components/themes/badges";
import { ThemePlaybook, PreBuySetupPanel, ThemeTippingPoints, TopOpportunitiesPanel, ThemeNarrative } from "@/components/themes/panels";
import { ThemeScreener, type ViewPreset, type ScreenerParams } from "@/components/themes/screener";
import { SIGNAL_STROKE, ThemeRelativeStrengthPlot, ThemePositioningMatrix, ThemeRiskMatrixPanel, ThemeEntryAdvisorPanel, CapitalRotationPanel, MomentumDivergencePanel } from "@/components/themes/panels";
import { ActiveRotationBanner, RotationMomentumStrip, ThemeEventsFeed, ThemeAlertFeed } from "@/components/themes/panels";
import ThemeAlertRiskMap from "@/components/ThemeAlertRiskMap";
import ThemeBuyCountdown from "@/components/ThemeBuyCountdown";
import ThemeScoreZPanel from "@/components/ThemeScoreZPanel";
import ThemeSignalStreakPanel from "@/components/ThemeSignalStreakPanel";
import { SECTOR_SHORT_NAMES } from "@/lib/sectors";




























function ThemeCard({ theme, history }: { theme: ThemeSummary; history: ThemeHistoryPoint[] }) {
  const signal = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;

  return (
    <Link href={`/themes/${theme.id}`} className="block group">
      <div className="bg-slate-800/70 border border-slate-700/60 rounded-lg p-4 hover:border-slate-500/80 hover:bg-slate-800 transition-all duration-150 group-hover:shadow-lg group-hover:shadow-black/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-sm leading-tight mb-1 truncate" style={{ fontFamily: "var(--font-rajdhani)" }}>
              {theme.name}
            </h3>
            <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">{theme.thesis}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <ScoreArc score={theme.compositeScore} />
            <ThemeSparkline history={history} />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${signal.bg} ${signal.color}`}>
            {signal.label}
          </span>
          <ThemePhaseBadge phase={theme.themePhase} />
          <PhaseTransitionBadge signal={theme.phaseTransitionSignal} />
          <RiskLevelBadge riskLevel={theme.riskLevel} />
          <EntryActionBadge action={theme.entryAction} rationale={theme.entryRationale} />
          <ConfluenceBadge confluenceScore={theme.confluenceScore} confidenceLabel={theme.confidenceLabel} />
          <MomentumAlignmentBadge alignment={theme.momentumAlignment} />
          <SignalFreshnessBadge history={history} signal={theme.dominantSignal} />
          <ScoreDeltaBadge history={history} />
          <FlowChip flow={theme.flow20d} />
          <TrendChip trend={theme.compositeTrend20d} />
          <DivergenceChip divergence={theme.divergenceFromParentSectors} />
          {theme.rs60 != null && (
            <span
              className={`text-[10px] font-mono ${scoreColor(theme.rs60 > 0 ? 0.65 : 0.3)}`}
              title={`Avg RS-60: ${theme.rs60 > 0 ? "+" : ""}${(theme.rs60 * 100).toFixed(1)}%`}
            >
              RS {theme.rs60 > 0 ? "+" : ""}{(theme.rs60 * 100).toFixed(1)}%
            </span>
          )}
        </div>

        <BullishBar bullish={theme.bullishCount} total={theme.constituentCount} />

        <div className="flex flex-wrap gap-1 mt-2.5">
          {theme.topConstituents.map(c => <EtfBubble key={c.categoryId} c={c} />)}
          {theme.constituentCount > theme.topConstituents.length && (
            <span className="text-[9px] font-mono text-slate-600">
              +{theme.constituentCount - theme.topConstituents.length}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}































function ThemeScoreHeatmap({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const DAYS = 20;

  // Collect all unique dates across all themes, take latest DAYS
  const allDates = Array.from(
    new Set(
      Object.values(historiesByThemeId)
        .flat()
        .map(h => h.date)
    )
  ).sort().slice(-DAYS);

  if (allDates.length < 5) return null;

  const sortedThemes = [...themes]
    .filter(t => (historiesByThemeId[t.id]?.length ?? 0) >= 3)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));

  if (sortedThemes.length === 0) return null;

  const scoreByThemeDate: Record<string, Record<string, number>> = {};
  for (const t of sortedThemes) {
    scoreByThemeDate[t.id] = {};
    for (const h of historiesByThemeId[t.id] ?? []) {
      scoreByThemeDate[t.id][h.date] = h.compositeScore;
    }
  }

  const cellColor = (score: number | undefined): string => {
    if (score == null) return "bg-slate-800/40";
    if (score >= 0.70) return "bg-emerald-500";
    if (score >= 0.65) return "bg-emerald-600/80";
    if (score >= 0.55) return "bg-cyan-600/70";
    if (score >= 0.50) return "bg-cyan-700/60";
    if (score >= 0.40) return "bg-amber-700/60";
    if (score >= 0.35) return "bg-red-700/60";
    return "bg-red-800/50";
  };

  // Show column labels every 5 days
  const dateLabels = allDates.map((d, i) => {
    const showLabel = i === 0 || i === allDates.length - 1 || (allDates.length - 1 - i) % 5 === 0;
    if (!showLabel) return null;
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  });

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Score Heatmap</span>
        <span className="text-[10px] text-slate-600 font-mono">last {allDates.length} trading days · red→amber→green = 0→100</span>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="text-[9px] font-mono w-full" style={{ minWidth: `${allDates.length * 14 + 120}px` }}>
          <thead>
            <tr>
              <th className="text-left text-slate-600 font-normal pb-1 pr-2 w-28">Theme</th>
              {allDates.map((d, i) => (
                <th key={d} className="text-center text-slate-600 font-normal pb-1 w-3" style={{ minWidth: "12px" }}>
                  {dateLabels[i] ? (
                    <span className="block" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", lineHeight: 1 }}>
                      {dateLabels[i]}
                    </span>
                  ) : null}
                </th>
              ))}
              <th className="text-center text-slate-600 font-normal pb-1 pl-2">Now</th>
            </tr>
          </thead>
          <tbody>
            {sortedThemes.map(t => {
              const scores = scoreByThemeDate[t.id];
              const currentPct = t.compositeScore != null ? Math.round(t.compositeScore * 100) : null;
              const currentClr = t.compositeScore == null ? "text-slate-600"
                : t.compositeScore >= 0.65 ? "text-emerald-400"
                : t.compositeScore >= 0.50 ? "text-cyan-400"
                : t.compositeScore >= 0.35 ? "text-amber-400" : "text-red-400";
              return (
                <tr key={t.id}>
                  <td className="py-0.5 pr-2 text-slate-400 truncate max-w-[112px]" style={{ maxWidth: "112px" }}>
                    <a href={`/themes/${t.id}`} className="hover:text-cyan-300 transition-colors truncate block">
                      {t.name.length > 16 ? t.name.slice(0, 15) + "…" : t.name}
                    </a>
                  </td>
                  {allDates.map(d => {
                    const score = scores[d];
                    return (
                      <td key={d} className="py-0.5 px-px" title={score != null ? `${t.name}: ${Math.round(score * 100)} (${d})` : `${t.name}: no data (${d})`}>
                        <div className={`w-2.5 h-2.5 rounded-sm ${cellColor(score)}`} />
                      </td>
                    );
                  })}
                  <td className={`py-0.5 pl-2 font-semibold ${currentClr} text-center`}>{currentPct ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ThemeRaceChart({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const validThemes = themes.filter(t => (historiesByThemeId[t.id]?.length ?? 0) >= 3);
  if (validThemes.length < 2) return null;

  const width = 600, height = 100;
  const padLeft = 4, padRight = 90, padTop = 8, padBottom = 16;
  const chartWidth = width - padLeft - padRight;
  const chartHeight = height - padTop - padBottom;

  const allPoints = validThemes.flatMap(t => historiesByThemeId[t.id].map(h => h.compositeScore));
  const globalMin = Math.max(0, Math.min(...allPoints) - 0.05);
  const globalMax = Math.min(1, Math.max(...allPoints) + 0.05);
  const yRange = globalMax - globalMin;

  const toY = (v: number) => padTop + chartHeight - ((v - globalMin) / yRange) * chartHeight;
  const buyY = toY(0.65);
  const reduceY = toY(0.35);

  const sortedByLatestScore = [...validThemes].sort((a, b) => {
    const aHist = historiesByThemeId[a.id];
    const bHist = historiesByThemeId[b.id];
    const aLast = aHist[aHist.length - 1]?.compositeScore ?? 0;
    const bLast = bHist[bHist.length - 1]?.compositeScore ?? 0;
    return bLast - aLast;
  });

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">30-day theme race · composite score</span>
        <span className="text-[10px] font-mono text-slate-600">all themes overlaid</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        {/* BUY threshold */}
        <line x1={padLeft} y1={buyY} x2={width - padRight} y2={buyY} stroke="#34d39920" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft} y={buyY - 2} fill="#34d39950" fontSize="6" fontFamily="monospace">BUY 65</text>
        {/* REDUCE threshold */}
        <line x1={padLeft} y1={reduceY} x2={width - padRight} y2={reduceY} stroke="#f8717120" strokeWidth="1" strokeDasharray="3 3" />
        <text x={padLeft} y={reduceY - 2} fill="#f8717150" fontSize="6" fontFamily="monospace">REDUCE 35</text>

        {validThemes.map(t => {
          const hist = historiesByThemeId[t.id];
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? "#64748b";
          const points = hist.map((h, i) => {
            const x = padLeft + (i / (hist.length - 1)) * chartWidth;
            const y = toY(h.compositeScore);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          const lastX = (padLeft + chartWidth).toFixed(1);
          const lastY = toY(hist[hist.length - 1].compositeScore).toFixed(1);
          return (
            <g key={t.id}>
              <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.2" strokeOpacity="0.7" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={lastX} cy={lastY} r="2.5" fill={stroke} fillOpacity="0.9" />
            </g>
          );
        })}

        {/* End-point labels stacked on right, sorted by score */}
        {sortedByLatestScore.map((t, rank) => {
          const hist = historiesByThemeId[t.id];
          const score = hist[hist.length - 1]?.compositeScore ?? 0;
          const stroke = SIGNAL_STROKE[t.dominantSignal] ?? "#64748b";
          const labelY = padTop + (rank * (chartHeight / (sortedByLatestScore.length - 1 || 1)));
          const lastX = padLeft + chartWidth;
          const lastY = toY(score);
          return (
            <g key={`label-${t.id}`}>
              <line x1={lastX + 2} y1={lastY} x2={lastX + 8} y2={labelY + 3} stroke={stroke} strokeWidth="0.5" strokeOpacity="0.4" />
              <text x={lastX + 10} y={labelY + 4} fill={stroke} fontSize="7" fontFamily="monospace" fontWeight="500">
                {themeShortLabel(t)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}






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

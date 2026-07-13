import Link from "next/link";
import { ThemeDetail, ThemeHistoryPoint } from "@/lib/api";
import { compareThemes } from "@/lib/themes/themeComparison";
import {
  ComparisonMetricRow,
  ComparisonSparkline,
  GradeBadge,
  SIGNAL_CONFIG,
  ScoreBarCell,
  scoreBarColor,
  scoreColor,
} from "@/components/themes/compare/cells";

/** Two themes side by side: who wins each metric, and the running score of those wins. */

export function ComparisonView({
  themeA,
  themeB,
  historyA,
  historyB,
}: {
  themeA: ThemeDetail;
  themeB: ThemeDetail;
  historyA: ThemeHistoryPoint[];
  historyB: ThemeHistoryPoint[];
}) {
  const signalCfgA = SIGNAL_CONFIG[themeA.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
  const signalCfgB = SIGNAL_CONFIG[themeB.dominantSignal] ?? SIGNAL_CONFIG.HOLD;

  const {
    winners,
    scoreDeltaA,
    scoreDeltaB,
    winsA: winA,
    winsB: winB,
    metricCount,
  } = compareThemes(themeA, themeB, historyA, historyB);

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/themes" className="text-[11px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
            ← themes
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-[11px] font-mono text-slate-600">compare</span>
        </div>

        {/* Theme header cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { theme: themeA, sigCfg: signalCfgA, wins: winA },
            { theme: themeB, sigCfg: signalCfgB, wins: winB },
          ].map(({ theme, sigCfg, wins }, idx) => (
            <div key={idx} className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link
                  href={`/themes/${theme.id}`}
                  className="text-sm font-semibold text-white hover:text-cyan-300 transition-colors leading-snug"
                  style={{ fontFamily: "var(--font-rajdhani)" }}
                  data-testid={`compare-theme-name-${idx === 0 ? "a" : "b"}`}
                >
                  {theme.name}
                </Link>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded shrink-0 ${sigCfg.bg} ${sigCfg.color}`}>
                  {sigCfg.label}
                </span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 mb-3">{theme.thesis}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${scoreBarColor(theme.compositeScore)}`}
                      style={{ width: `${Math.round((theme.compositeScore ?? 0) * 100)}%` }} />
                  </div>
                  <span className={`text-sm font-mono font-bold ${scoreColor(theme.compositeScore)}`}>
                    {theme.compositeScore != null ? Math.round(theme.compositeScore * 100) : "—"}
                  </span>
                </div>
                <span className={`text-[11px] font-mono ${wins > 6 ? "text-emerald-400" : wins > 4 ? "text-cyan-400" : "text-slate-500"}`}>
                  {wins} / {metricCount} wins
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Swap link */}
        <div className="flex justify-center mb-5">
          <Link
            href={`/themes/compare?a=${themeB.id}&b=${themeA.id}`}
            className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors border border-slate-700/40 hover:border-slate-600/60 px-3 py-1 rounded"
            data-testid="compare-swap-link"
          >
            ⇄ swap A / B
          </Link>
        </div>

        {/* Dual sparkline */}
        <ComparisonSparkline
          historyA={historyA}
          historyB={historyB}
          nameA={themeA.name}
          nameB={themeB.name}
        />

        {/* Metric comparison table */}
        <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden mb-6" data-testid="comparison-table">
          <div className="grid grid-cols-3 border-b border-slate-700/40 text-[9px] font-semibold uppercase tracking-wider">
            <div className="px-4 py-2.5 text-slate-600">Metric</div>
            <div className="px-4 py-2.5 text-slate-300 truncate">{themeA.name}</div>
            <div className="px-4 py-2.5 text-slate-500 truncate">{themeB.name}</div>
          </div>
          <table className="w-full">
            <tbody>
              <ComparisonMetricRow
                label="Score"
                cellA={<ScoreBarCell score={themeA.compositeScore} />}
                cellB={<ScoreBarCell score={themeB.compositeScore} />}
                winner={winners.score}
              />
              <ComparisonMetricRow
                label="Signal"
                cellA={
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${signalCfgA.bg} ${signalCfgA.color}`}>
                    {themeA.dominantSignal}
                  </span>
                }
                cellB={
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${signalCfgB.bg} ${signalCfgB.color}`}>
                    {themeB.dominantSignal}
                  </span>
                }
                winner={winners.signal}
              />
              <ComparisonMetricRow
                label="Phase"
                cellA={
                  <span className="text-xs font-mono text-slate-300">
                    {themeA.themePhase ?? "—"}
                    {themeA.phaseStreakDays > 0 && (
                      <span className="text-slate-600 ml-1 text-[10px]">{themeA.phaseStreakDays}d</span>
                    )}
                  </span>
                }
                cellB={
                  <span className="text-xs font-mono text-slate-300">
                    {themeB.themePhase ?? "—"}
                    {themeB.phaseStreakDays > 0 && (
                      <span className="text-slate-600 ml-1 text-[10px]">{themeB.phaseStreakDays}d</span>
                    )}
                  </span>
                }
                winner={winners.phase}
              />
              <ComparisonMetricRow
                label="5d Δ"
                subtitle="score momentum"
                cellA={
                  <span className={`text-xs font-mono tabular-nums ${scoreDeltaA == null ? "text-slate-600" : scoreDeltaA > 0 ? "text-emerald-400" : scoreDeltaA < 0 ? "text-red-400" : "text-slate-500"}`}>
                    {scoreDeltaA == null ? "—" : `${scoreDeltaA > 0 ? "+" : ""}${scoreDeltaA}pt`}
                  </span>
                }
                cellB={
                  <span className={`text-xs font-mono tabular-nums ${scoreDeltaB == null ? "text-slate-600" : scoreDeltaB > 0 ? "text-emerald-400" : scoreDeltaB < 0 ? "text-red-400" : "text-slate-500"}`}>
                    {scoreDeltaB == null ? "—" : `${scoreDeltaB > 0 ? "+" : ""}${scoreDeltaB}pt`}
                  </span>
                }
                winner={winners.scoreDelta5d}
              />
              <ComparisonMetricRow
                label="IQS"
                subtitle="investment quality"
                cellA={<GradeBadge grade={themeA.investmentQualityGrade} score={themeA.investmentQualityScore} label="IQS" />}
                cellB={<GradeBadge grade={themeB.investmentQualityGrade} score={themeB.investmentQualityScore} label="IQS" />}
                winner={winners.investmentQuality}
              />
              <ComparisonMetricRow
                label="Persist"
                subtitle="phase persistence"
                cellA={<GradeBadge grade={themeA.persistenceGrade} score={themeA.persistenceScore} label="Persistence" />}
                cellB={<GradeBadge grade={themeB.persistenceGrade} score={themeB.persistenceScore} label="Persistence" />}
                winner={winners.persistence}
              />
              <ComparisonMetricRow
                label="Conf"
                subtitle="signal confluence"
                cellA={<span className="text-xs font-mono tabular-nums text-slate-300">{themeA.confluenceScore}</span>}
                cellB={<span className="text-xs font-mono tabular-nums text-slate-300">{themeB.confluenceScore}</span>}
                winner={winners.confluence}
              />
              <ComparisonMetricRow
                label="RS-60"
                subtitle="vs SPY"
                cellA={
                  themeA.rs60 != null
                    ? <span className={`text-xs font-mono tabular-nums ${themeA.rs60 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {themeA.rs60 > 0 ? "+" : ""}{(themeA.rs60 * 100).toFixed(1)}%
                      </span>
                    : <span className="text-slate-600 text-xs font-mono">—</span>
                }
                cellB={
                  themeB.rs60 != null
                    ? <span className={`text-xs font-mono tabular-nums ${themeB.rs60 > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {themeB.rs60 > 0 ? "+" : ""}{(themeB.rs60 * 100).toFixed(1)}%
                      </span>
                    : <span className="text-slate-600 text-xs font-mono">—</span>
                }
                winner={winners.rs60}
              />
              <ComparisonMetricRow
                label="Flow"
                subtitle="20d avg z-score"
                cellA={
                  themeA.flow20d != null
                    ? <span className={`text-xs font-mono tabular-nums ${themeA.flow20d > 0.3 ? "text-emerald-400" : themeA.flow20d < -0.3 ? "text-red-400" : "text-slate-400"}`}>
                        {themeA.flow20d > 0.3 ? "↑" : themeA.flow20d < -0.3 ? "↓" : "→"} {themeA.flow20d.toFixed(2)}σ
                      </span>
                    : <span className="text-slate-600 text-xs font-mono">—</span>
                }
                cellB={
                  themeB.flow20d != null
                    ? <span className={`text-xs font-mono tabular-nums ${themeB.flow20d > 0.3 ? "text-emerald-400" : themeB.flow20d < -0.3 ? "text-red-400" : "text-slate-400"}`}>
                        {themeB.flow20d > 0.3 ? "↑" : themeB.flow20d < -0.3 ? "↓" : "→"} {themeB.flow20d.toFixed(2)}σ
                      </span>
                    : <span className="text-slate-600 text-xs font-mono">—</span>
                }
                winner={winners.flow}
              />
              <ComparisonMetricRow
                label="Vol 30d"
                subtitle="lower = less volatile"
                cellA={
                  themeA.volatility30d != null
                    ? <span className={`text-xs font-mono tabular-nums ${themeA.volatility30d < 0.03 ? "text-emerald-400" : themeA.volatility30d > 0.07 ? "text-red-400" : "text-amber-400"}`}>
                        {(themeA.volatility30d * 100).toFixed(1)}%
                      </span>
                    : <span className="text-slate-600 text-xs font-mono">—</span>
                }
                cellB={
                  themeB.volatility30d != null
                    ? <span className={`text-xs font-mono tabular-nums ${themeB.volatility30d < 0.03 ? "text-emerald-400" : themeB.volatility30d > 0.07 ? "text-red-400" : "text-amber-400"}`}>
                        {(themeB.volatility30d * 100).toFixed(1)}%
                      </span>
                    : <span className="text-slate-600 text-xs font-mono">—</span>
                }
                winner={winners.volatility}
              />
              <ComparisonMetricRow
                label="Streak"
                subtitle="signal streak days"
                cellA={<span className="text-xs font-mono tabular-nums text-slate-300">{themeA.signalStreakDays}d</span>}
                cellB={<span className="text-xs font-mono tabular-nums text-slate-300">{themeB.signalStreakDays}d</span>}
                winner={winners.streak}
              />
              <ComparisonMetricRow
                label="Alerts 30d"
                subtitle="lower = fewer events"
                cellA={
                  <span className={`text-xs font-mono tabular-nums ${themeA.alertCount30d > 5 ? "text-amber-400" : "text-slate-400"}`}>
                    {themeA.alertCount30d}
                  </span>
                }
                cellB={
                  <span className={`text-xs font-mono tabular-nums ${themeB.alertCount30d > 5 ? "text-amber-400" : "text-slate-400"}`}>
                    {themeB.alertCount30d}
                  </span>
                }
                winner={winners.alerts}
              />
            </tbody>
          </table>
        </div>

        {/* Footer links */}
        <div className="flex items-center justify-between text-[10px] font-mono">
          <Link href={`/themes/${themeA.id}`} className="text-cyan-600 hover:text-cyan-400 transition-colors">
            {themeA.name} detail →
          </Link>
          <Link href="/themes" className="text-slate-600 hover:text-slate-400 transition-colors">
            ← all themes
          </Link>
          <Link href={`/themes/${themeB.id}`} className="text-slate-500 hover:text-slate-300 transition-colors">
            {themeB.name} detail →
          </Link>
        </div>
      </div>
    </main>
  );
}

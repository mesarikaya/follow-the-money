import Link from "next/link";
import { fetchTheme, fetchThemeHistory, fetchThemes, ThemeDetail, ThemeHistoryPoint } from "@/lib/api";

// ── Shared primitives ────────────────────────────────────────────────────────

const SIGNAL_ORDER: Record<string, number> = { BUY: 4, WATCH: 3, HOLD: 2, REDUCE: 1 };
const PHASE_ORDER: Record<string, number> = {
  BREAKOUT: 8, MOMENTUM: 7, SETUP: 6, BUILDING: 5,
  HOLDING: 4, FADING: 3, DISTRIBUTE: 2, WEAK: 1,
};
const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

const SIGNAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  BUY:    { label: "BUY",    color: "text-emerald-400", bg: "bg-emerald-500/15 border border-emerald-500/30" },
  WATCH:  { label: "WATCH",  color: "text-cyan-400",    bg: "bg-cyan-500/15 border border-cyan-500/30" },
  HOLD:   { label: "HOLD",   color: "text-slate-400",   bg: "bg-slate-700/60 border border-slate-600/40" },
  REDUCE: { label: "REDUCE", color: "text-red-400",     bg: "bg-red-500/15 border border-red-500/30" },
};

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-400", B: "text-cyan-400", C: "text-amber-400", D: "text-orange-400", F: "text-red-400",
};

function gradeColor(grade: string) { return GRADE_COLOR[grade] ?? "text-slate-400"; }

function scoreColor(score: number | null) {
  if (score == null) return "text-slate-500";
  return score >= 0.65 ? "text-emerald-400" : score >= 0.50 ? "text-cyan-400" : score >= 0.35 ? "text-amber-400" : "text-red-400";
}

function scoreBarColor(score: number | null) {
  if (score == null) return "bg-slate-600";
  return score >= 0.65 ? "bg-emerald-500" : score >= 0.50 ? "bg-cyan-500" : score >= 0.35 ? "bg-amber-500" : "bg-red-500";
}

// ── Dual sparkline ────────────────────────────────────────────────────────────

function ComparisonSparkline({
  historyA,
  historyB,
  nameA,
  nameB,
}: {
  historyA: ThemeHistoryPoint[];
  historyB: ThemeHistoryPoint[];
  nameA: string;
  nameB: string;
}) {
  if (historyA.length < 2 && historyB.length < 2) return null;
  const W = 480, H = 80, padX = 8, padY = 8;

  const allVals = [
    ...historyA.map(h => h.compositeScore),
    ...historyB.map(h => h.compositeScore),
  ];
  const minV = Math.min(...allVals) - 0.02;
  const maxV = Math.max(...allVals) + 0.02;
  const range = Math.max(maxV - minV, 0.01);
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const toPath = (hist: ThemeHistoryPoint[]) => {
    if (hist.length < 2) return "";
    return hist
      .map((h, i) => {
        const x = padX + (i / (hist.length - 1)) * chartW;
        const y = padY + (1 - (h.compositeScore - minV) / range) * chartH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const latA = historyA[historyA.length - 1]?.compositeScore ?? 0;
  const latB = historyB[historyB.length - 1]?.compositeScore ?? 0;
  const colorA = latA >= 0.65 ? "#34d399" : latA >= 0.50 ? "#22d3ee" : latA >= 0.35 ? "#fbbf24" : "#f87171";
  const colorB = latB >= 0.65 ? "#34d399" : latB >= 0.50 ? "#22d3ee" : latB >= 0.35 ? "#fbbf24" : "#f87171";

  const buyY = padY + (1 - (0.65 - minV) / range) * chartH;
  const watchY = padY + (1 - (0.50 - minV) / range) * chartH;

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-6 mb-3 text-[10px] font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 rounded" style={{ backgroundColor: colorA }} />
          <span className="text-slate-400">{nameA}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-8 h-0.5 rounded opacity-60" style={{ backgroundColor: colorB, borderTop: "2px dashed" }} />
          <span className="text-slate-500">{nameB}</span>
        </div>
        <span className="ml-auto text-slate-700">30-day scores</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="overflow-visible">
        {buyY >= padY && buyY <= padY + chartH && (
          <>
            <line x1={padX} y1={buyY} x2={W - padX} y2={buyY} stroke="#34d39920" strokeWidth="1" strokeDasharray="3 2" />
            <text x={padX + 2} y={buyY - 2} fill="#34d39940" fontSize="7" fontFamily="monospace">BUY 65</text>
          </>
        )}
        {watchY >= padY && watchY <= padY + chartH && (
          <line x1={padX} y1={watchY} x2={W - padX} y2={watchY} stroke="#22d3ee15" strokeWidth="1" strokeDasharray="2 3" />
        )}
        {historyB.length >= 2 && (
          <path d={toPath(historyB)} fill="none" stroke={colorB} strokeWidth="1.5" strokeOpacity="0.5" strokeDasharray="4 2" strokeLinecap="round" />
        )}
        {historyA.length >= 2 && (
          <path d={toPath(historyA)} fill="none" stroke={colorA} strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    </div>
  );
}

// ── Metric comparison row ─────────────────────────────────────────────────────

type WinnerSide = "A" | "B" | "tie";

function ComparisonMetricRow({
  label,
  cellA,
  cellB,
  winner,
  subtitle,
}: {
  label: string;
  cellA: React.ReactNode;
  cellB: React.ReactNode;
  winner: WinnerSide;
  subtitle?: string;
}) {
  const winnerClass = "bg-slate-700/30";
  return (
    <tr className="border-t border-slate-700/30 hover:bg-slate-800/30 transition-colors">
      <td className="py-2.5 px-4 text-[10px] font-mono text-slate-500 uppercase tracking-wider w-28 shrink-0">
        {label}
        {subtitle && <div className="text-[9px] text-slate-700 normal-case tracking-normal font-normal mt-0.5">{subtitle}</div>}
      </td>
      <td className={`py-2.5 px-4 text-left ${winner === "A" ? winnerClass : ""}`}>
        <div className="flex items-center gap-1.5">
          {winner === "A" && <span className="text-emerald-400 text-[9px] font-mono">✓</span>}
          {cellA}
        </div>
      </td>
      <td className={`py-2.5 px-4 text-left ${winner === "B" ? winnerClass : ""}`}>
        <div className="flex items-center gap-1.5">
          {winner === "B" && <span className="text-emerald-400 text-[9px] font-mono">✓</span>}
          {cellB}
        </div>
      </td>
    </tr>
  );
}

// ── Score bar cell ─────────────────────────────────────────────────────────────

function ScoreBarCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-600 text-xs font-mono">—</span>;
  const pct = Math.round(score * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="w-14 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${scoreBarColor(score)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-mono tabular-nums ${scoreColor(score)}`}>{pct}</span>
    </div>
  );
}

// ── Grade badge ────────────────────────────────────────────────────────────────

function GradeBadge({ grade, score, label }: { grade: string; score: number; label: string }) {
  return (
    <span
      className={`text-xs font-mono font-bold ${gradeColor(grade)}`}
      title={`${label}: ${score}/100`}
    >
      {grade}
      <span className="text-slate-600 font-normal ml-1">({score})</span>
    </span>
  );
}

// ── Helper: compare numeric (higher is better) ────────────────────────────────

function compareHigher(a: number | null, b: number | null): WinnerSide {
  if (a == null && b == null) return "tie";
  if (a == null) return "B";
  if (b == null) return "A";
  if (Math.abs(a - b) < 0.0001) return "tie";
  return a > b ? "A" : "B";
}

function compareLower(a: number | null, b: number | null): WinnerSide {
  if (a == null && b == null) return "tie";
  if (a == null) return "B";
  if (b == null) return "A";
  if (Math.abs(a - b) < 0.0001) return "tie";
  return a < b ? "A" : "B";
}

function compareOrdered(a: number, b: number): WinnerSide {
  if (a === b) return "tie";
  return a > b ? "A" : "B";
}

// ── Full comparison view ──────────────────────────────────────────────────────

function ComparisonView({
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

  const scoreDeltaA = historyA.length >= 6
    ? Math.round((historyA[historyA.length - 1].compositeScore - historyA[historyA.length - 6].compositeScore) * 100)
    : null;
  const scoreDeltaB = historyB.length >= 6
    ? Math.round((historyB[historyB.length - 1].compositeScore - historyB[historyB.length - 6].compositeScore) * 100)
    : null;

  const signalWinner = compareOrdered(
    SIGNAL_ORDER[themeA.dominantSignal] ?? 0,
    SIGNAL_ORDER[themeB.dominantSignal] ?? 0,
  );
  const phaseWinner = compareOrdered(
    PHASE_ORDER[themeA.themePhase ?? ""] ?? 0,
    PHASE_ORDER[themeB.themePhase ?? ""] ?? 0,
  );
  const iqsWinner = compareHigher(themeA.investmentQualityScore, themeB.investmentQualityScore);
  const persistWinner = compareHigher(themeA.persistenceScore, themeB.persistenceScore);
  const confWinner = compareHigher(themeA.confluenceScore, themeB.confluenceScore);
  const scoreWinner = compareHigher(themeA.compositeScore, themeB.compositeScore);
  const delta5dWinner = compareHigher(scoreDeltaA, scoreDeltaB);
  const rs60Winner = compareHigher(themeA.rs60, themeB.rs60);
  const flowWinner = compareHigher(themeA.flow20d, themeB.flow20d);
  const volWinner = compareLower(themeA.volatility30d, themeB.volatility30d);
  const streakWinner = compareHigher(themeA.signalStreakDays, themeB.signalStreakDays);
  const alertWinner = compareLower(themeA.alertCount30d, themeB.alertCount30d);

  const winA = [signalWinner, phaseWinner, iqsWinner, persistWinner, confWinner, scoreWinner,
    delta5dWinner, rs60Winner, flowWinner, volWinner, streakWinner, alertWinner].filter(w => w === "A").length;
  const winB = [signalWinner, phaseWinner, iqsWinner, persistWinner, confWinner, scoreWinner,
    delta5dWinner, rs60Winner, flowWinner, volWinner, streakWinner, alertWinner].filter(w => w === "B").length;

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
                  {wins} / 12 wins
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
                winner={scoreWinner}
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
                winner={signalWinner}
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
                winner={phaseWinner}
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
                winner={delta5dWinner}
              />
              <ComparisonMetricRow
                label="IQS"
                subtitle="investment quality"
                cellA={<GradeBadge grade={themeA.investmentQualityGrade} score={themeA.investmentQualityScore} label="IQS" />}
                cellB={<GradeBadge grade={themeB.investmentQualityGrade} score={themeB.investmentQualityScore} label="IQS" />}
                winner={iqsWinner}
              />
              <ComparisonMetricRow
                label="Persist"
                subtitle="phase persistence"
                cellA={<GradeBadge grade={themeA.persistenceGrade} score={themeA.persistenceScore} label="Persistence" />}
                cellB={<GradeBadge grade={themeB.persistenceGrade} score={themeB.persistenceScore} label="Persistence" />}
                winner={persistWinner}
              />
              <ComparisonMetricRow
                label="Conf"
                subtitle="signal confluence"
                cellA={<span className="text-xs font-mono tabular-nums text-slate-300">{themeA.confluenceScore}</span>}
                cellB={<span className="text-xs font-mono tabular-nums text-slate-300">{themeB.confluenceScore}</span>}
                winner={confWinner}
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
                winner={rs60Winner}
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
                winner={flowWinner}
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
                winner={volWinner}
              />
              <ComparisonMetricRow
                label="Streak"
                subtitle="signal streak days"
                cellA={<span className="text-xs font-mono tabular-nums text-slate-300">{themeA.signalStreakDays}d</span>}
                cellB={<span className="text-xs font-mono tabular-nums text-slate-300">{themeB.signalStreakDays}d</span>}
                winner={streakWinner}
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
                winner={alertWinner}
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

// ── Theme picker (when params incomplete) ─────────────────────────────────────

function ThemePickerPage({
  themes,
  firstTheme,
}: {
  themes: { id: string; name: string; dominantSignal: string; compositeScore: number | null }[];
  firstTheme?: ThemeDetail;
}) {
  const sortedThemes = [...themes].sort((a, b) => (b.compositeScore ?? -1) - (a.compositeScore ?? -1));

  return (
    <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-5">
          <Link href="/themes" className="text-[11px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
            ← themes
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-[11px] font-mono text-slate-600">compare</span>
        </div>

        <h1 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
          Compare Themes
        </h1>
        <p className="text-slate-400 text-sm mb-5">
          {firstTheme
            ? `Compare ${firstTheme.name} with another theme — pick one below.`
            : "Select two themes for a side-by-side metric comparison."}
        </p>

        {firstTheme && (
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-0.5">Comparing</div>
              <span className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-rajdhani)" }}>
                {firstTheme.name}
              </span>
            </div>
            <Link href="/themes/compare" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
              clear ✕
            </Link>
          </div>
        )}

        <div className="bg-slate-800/40 border border-slate-700/60 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-700/40 text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            {firstTheme ? "Pick second theme" : "Pick first theme"}
          </div>
          <div className="divide-y divide-slate-700/20">
            {sortedThemes
              .filter(t => !firstTheme || t.id !== firstTheme.id)
              .map(t => {
                const sigCfg = SIGNAL_CONFIG[t.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
                const href = firstTheme
                  ? `/themes/compare?a=${firstTheme.id}&b=${t.id}`
                  : `/themes/compare?a=${t.id}`;
                return (
                  <Link
                    key={t.id}
                    href={href}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/30 transition-colors"
                    data-testid={`picker-theme-${t.id}`}
                  >
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${sigCfg.bg} ${sigCfg.color} shrink-0`}>
                      {t.dominantSignal}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-200 flex-1">{t.name}</span>
                    <span className={`text-[10px] font-mono tabular-nums shrink-0 ${scoreColor(t.compositeScore)}`}>
                      {t.compositeScore != null ? Math.round(t.compositeScore * 100) : "—"}
                    </span>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Page export ────────────────────────────────────────────────────────────────

export default async function ThemeComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;

  if (!a || !b) {
    const [allThemes, firstTheme] = await Promise.all([
      fetchThemes().catch(() => []),
      a ? fetchTheme(a).catch(() => null) : Promise.resolve(null),
    ]);
    return (
      <ThemePickerPage
        themes={allThemes}
        firstTheme={firstTheme ?? undefined}
      />
    );
  }

  const [themeA, themeB, historyA, historyB] = await Promise.all([
    fetchTheme(a).catch(() => null),
    fetchTheme(b).catch(() => null),
    fetchThemeHistory(a, 30).catch(() => [] as ThemeHistoryPoint[]),
    fetchThemeHistory(b, 30).catch(() => [] as ThemeHistoryPoint[]),
  ]);

  if (!themeA || !themeB) {
    return (
      <main className="flex-1 min-h-0 overflow-y-auto bg-slate-900 p-6">
        <div className="max-w-lg mx-auto text-center py-16">
          <p className="text-slate-400 mb-4">One or both themes not found.</p>
          <Link href="/themes/compare" className="text-cyan-500 text-sm hover:text-cyan-400">
            ← Start over
          </Link>
        </div>
      </main>
    );
  }

  return (
    <ComparisonView
      themeA={themeA}
      themeB={themeB}
      historyA={historyA}
      historyB={historyB}
    />
  );
}

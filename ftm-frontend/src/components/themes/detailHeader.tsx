import { ThemeConstituent, ThemeDetail } from "@/lib/api";
import { SIGNAL_CONFIG } from "@/components/themes/badges";
import { computeWatchGuidance, isCrowdedTrade } from "@/lib/themes/themeDetail";
import ThemeScoreGauge from "@/components/ThemeScoreGauge";

/** The header card of the theme detail page: thesis, headline signal, and every aggregate metric. */

const PHASE_CONFIG_DETAIL: Record<string, { label: string; className: string }> = {
  BREAKOUT:  { label: "↗ BREAKOUT",  className: "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30" },
  MOMENTUM:  { label: "↑ MOMENTUM",  className: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25" },
  SETUP:     { label: "⬆ SETUP",     className: "bg-sky-500/15 text-sky-400 border border-sky-500/25" },
  BUILDING:  { label: "→ BUILDING",  className: "bg-slate-700/60 text-slate-400 border border-slate-600/40" },
  HOLDING:   { label: "■ HOLDING",   className: "bg-slate-700/40 text-slate-500 border border-slate-700/40" },
  FADING:    { label: "↓ FADING",    className: "bg-amber-500/15 text-amber-400 border border-amber-500/25" },
  DISTRIBUTE: { label: "↘ DISTRIBUTING", className: "bg-orange-500/15 text-orange-400 border border-orange-500/25" },
  WEAK:      { label: "↓ WEAK",      className: "bg-red-500/15 text-red-400 border border-red-500/25" },
};

const GRADE_COLORS: Record<string, string> = {
  A: "text-emerald-400",
  B: "text-cyan-400",
  C: "text-amber-400",
  D: "text-orange-400",
};

const gradeColor = (grade: string) => GRADE_COLORS[grade] ?? "text-red-400";

const AggMetric = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="text-center">
    <div className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5" style={{ fontFamily: "var(--font-jetbrains-mono)" }}>
      {label}
    </div>
    {children}
  </div>
);

const MetricValue = ({ className, title, children }: { className: string; title?: string; children: React.ReactNode }) => (
  <span className={`text-base font-bold font-mono ${className}`} title={title}>
    {children}
  </span>
);

const NoValue = () => <span className="text-slate-600">—</span>;

const SignalDistributionBar = ({ constituents }: { constituents: ThemeConstituent[] }) => {
  const total = constituents.length;
  if (total === 0) return null;
  const countOf = (signal: string) => constituents.filter(c => c.tradeSignal === signal).length;
  const buy = countOf("BUY");
  const watch = countOf("WATCH");
  const reduce = countOf("REDUCE");
  const segments = [
    { count: buy,                          color: "#34d399", label: "BUY" },
    { count: watch,                        color: "#22d3ee", label: "WATCH" },
    { count: total - buy - watch - reduce, color: "#475569", label: "HOLD" },
    { count: reduce,                       color: "#f87171", label: "REDUCE" },
  ].filter(s => s.count > 0);
  return (
    <div className="mt-3">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Signal Distribution</div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {segments.map(s => (
          <div
            key={s.label}
            style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color + "cc" }}
            title={`${s.label}: ${s.count}/${total}`}
          />
        ))}
      </div>
      <div className="flex gap-3 mt-1">
        {segments.map(s => (
          <span key={s.label} className="text-[9px] font-mono" style={{ color: s.color }}>
            {s.count} {s.label}
          </span>
        ))}
      </div>
    </div>
  );
};

const dotColorFor = (score: number) =>
  score >= 0.65 ? "#34d399" : score >= 0.50 ? "#22d3ee" : score >= 0.35 ? "#fbbf24" : "#f87171";

const ConstituentScoreSpread = ({ constituents }: { constituents: ThemeConstituent[] }) => {
  const scored = constituents
    .filter(c => c.compositeScore != null)
    .sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  if (scored.length < 2) return null;

  const scores = scored.map(c => c.compositeScore!);
  const maxScore = scores[0];
  const minScore = scores[scores.length - 1];
  const spread = Math.round((maxScore - minScore) * 100);
  const spreadColor = spread >= 30 ? "#f87171" : spread >= 20 ? "#fbbf24" : "#34d399";

  const toX = (score: number) => `${(score * 100).toFixed(1)}%`;

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/40">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Constituent Score Spread</span>
        <span className="text-[10px] font-mono" style={{ color: spreadColor }}>
          {spread}pt spread
        </span>
        {spread >= 30 && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
            peer divergence
          </span>
        )}
      </div>
      <div className="relative h-8">
        <div className="absolute inset-0 rounded overflow-hidden flex">
          <div className="h-full bg-red-500/5" style={{ width: "35%" }} />
          <div className="h-full bg-amber-500/5" style={{ width: "15%" }} />
          <div className="h-full bg-slate-700/20" style={{ width: "15%" }} />
          <div className="h-full bg-emerald-500/5" style={{ width: "35%" }} />
        </div>
        <div className="absolute top-0 bottom-0 w-px bg-emerald-500/30" style={{ left: "65%" }} title="BUY 65" />
        <div className="absolute top-0 bottom-0 w-px bg-red-500/30" style={{ left: "35%" }} title="REDUCE 35" />
        <div
          className="absolute top-3 h-0.5 rounded-full opacity-40"
          style={{ left: toX(minScore), width: `${spread}%`, backgroundColor: spreadColor }}
        />
        {scored.map((constituent, index) => {
          const score = constituent.compositeScore!;
          const isLeader = index === 0;
          const isLaggard = index === scored.length - 1;
          const pct = Math.round(score * 100);
          const dotColor = dotColorFor(score);
          return (
            <div
              key={constituent.categoryId}
              className="absolute top-0 bottom-0 flex flex-col items-center justify-center"
              style={{ left: toX(score), transform: "translateX(-50%)" }}
              title={`${constituent.name}: ${pct}`}
            >
              <div className="w-2 h-2 rounded-full border border-slate-900" style={{ backgroundColor: dotColor }} />
              {(isLeader || isLaggard) && (
                <span
                  className="absolute text-[8px] font-mono whitespace-nowrap"
                  style={{ color: dotColor, top: isLeader ? "-12px" : "20px" }}
                >
                  {constituent.etfTicker} {pct}
                </span>
              )}
            </div>
          );
        })}
        <div className="absolute bottom-0 left-0 text-[7px] font-mono text-slate-700">0</div>
        <div className="absolute bottom-0 right-0 text-[7px] font-mono text-slate-700">100</div>
        <div className="absolute bottom-0 text-[7px] font-mono text-emerald-700/60" style={{ left: "65%", transform: "translateX(-50%)" }}>65</div>
        <div className="absolute bottom-0 text-[7px] font-mono text-red-700/60" style={{ left: "35%", transform: "translateX(-50%)" }}>35</div>
      </div>
    </div>
  );
};

const ThemeIdentity = ({ theme }: { theme: ThemeDetail }) => {
  const signal = SIGNAL_CONFIG[theme.dominantSignal] ?? SIGNAL_CONFIG.HOLD;
  const phase = theme.themePhase ? PHASE_CONFIG_DETAIL[theme.themePhase] : undefined;
  return (
    <div className="flex items-start justify-between gap-4 mb-3">
      <div>
        <h1 className="text-lg font-bold text-white mb-1" style={{ fontFamily: "var(--font-rajdhani)" }}>
          {theme.name}
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">{theme.thesis}</p>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <ThemeScoreGauge score={theme.compositeScore} signal={theme.dominantSignal} />
        <span className={`text-xs font-semibold px-2.5 py-1 rounded ${signal.bg} ${signal.color}`}>
          {signal.label}
        </span>
        {phase && (
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${phase.className}`}>{phase.label}</span>
        )}
        {isCrowdedTrade(theme) && (
          <span
            className="text-[9px] font-semibold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30"
            title="Score ≥65, flow ≥1.5σ, divergence ≥+8pt — all signals agree: potentially crowded. Consider sizing conservatively."
          >
            ⚠ Crowded Trade
          </span>
        )}
      </div>
    </div>
  );
};

const VelocityMetric = ({ trend5d, trend20d }: { trend5d: number; trend20d: number }) => {
  const delta = trend5d - trend20d;
  const isAccelerating = delta > 0.002;
  const isDecelerating = delta < -0.002;
  return (
    <AggMetric label="Velocity">
      <MetricValue
        className={isAccelerating ? "text-emerald-400" : isDecelerating ? "text-red-400" : "text-slate-400"}
        title={`5d trend ${trend5d > 0 ? "+" : ""}${(trend5d * 100).toFixed(1)}pt vs 20d ${trend20d > 0 ? "+" : ""}${(trend20d * 100).toFixed(1)}pt`}
      >
        {isAccelerating ? "⬆" : isDecelerating ? "⬇" : "◆"}
      </MetricValue>
    </AggMetric>
  );
};

const ThemeAggregateMetrics = ({ theme }: { theme: ThemeDetail }) => (
  <div className="flex gap-6 flex-wrap">
    <AggMetric label="Composite">
      {theme.compositeScore != null ? (
        <MetricValue
          className={
            theme.compositeScore >= 0.65 ? "text-emerald-400"
            : theme.compositeScore >= 0.50 ? "text-cyan-400"
            : theme.compositeScore >= 0.35 ? "text-amber-400"
            : "text-red-400"
          }
        >
          {Math.round(theme.compositeScore * 100)}
        </MetricValue>
      ) : <NoValue />}
    </AggMetric>

    <AggMetric label="Avg RS-60">
      {theme.rs60 != null ? (
        <MetricValue className={theme.rs60 > 0 ? "text-emerald-400" : "text-red-400"}>
          {theme.rs60 > 0 ? "+" : ""}{(theme.rs60 * 100).toFixed(1)}%
        </MetricValue>
      ) : <NoValue />}
    </AggMetric>

    <AggMetric label="Flow 20d">
      {theme.flow20d != null ? (
        <MetricValue className={theme.flow20d > 0.3 ? "text-emerald-400" : theme.flow20d < -0.3 ? "text-red-400" : "text-slate-400"}>
          {theme.flow20d > 0 ? "+" : ""}{theme.flow20d.toFixed(2)}σ
        </MetricValue>
      ) : <NoValue />}
    </AggMetric>

    <AggMetric label="Momentum">
      {theme.compositeTrend20d != null ? (
        <MetricValue className={theme.compositeTrend20d > 0.005 ? "text-emerald-400" : theme.compositeTrend20d < -0.005 ? "text-red-400" : "text-slate-400"}>
          {theme.compositeTrend20d > 0 ? "↑" : theme.compositeTrend20d < 0 ? "↓" : "→"}
          {" "}<span className="text-[11px]">{Math.round(Math.abs(theme.compositeTrend20d) * 1000)}‰</span>
        </MetricValue>
      ) : <NoValue />}
    </AggMetric>

    {theme.compositeTrend5d != null && theme.compositeTrend20d != null && (
      <VelocityMetric trend5d={theme.compositeTrend5d} trend20d={theme.compositeTrend20d} />
    )}

    <AggMetric label="Bullish">
      <MetricValue className="text-slate-300">
        {theme.bullishCount}/{theme.constituentCount}
      </MetricValue>
    </AggMetric>

    {theme.divergenceFromParentSectors != null && (
      <AggMetric label="vs Sectors">
        <MetricValue
          className={
            theme.divergenceFromParentSectors > 0.02 ? "text-emerald-400"
            : theme.divergenceFromParentSectors < -0.02 ? "text-red-400"
            : "text-slate-400"
          }
          title="Theme composite minus average parent-sector composite. Positive = theme sub-sectors outpacing their broad sector — early rotation signal."
        >
          {theme.divergenceFromParentSectors > 0 ? "+" : ""}
          {Math.round(theme.divergenceFromParentSectors * 100)}pt
        </MetricValue>
      </AggMetric>
    )}

    {theme.signalStreakDays > 0 && (
      <AggMetric label="Streak">
        <MetricValue
          className={theme.signalStreakDays >= 10 ? "text-emerald-400" : theme.signalStreakDays >= 5 ? "text-cyan-400" : "text-slate-400"}
          title={`${theme.signalStreakDays} consecutive days on the same signal`}
        >
          {theme.signalStreakDays}d
        </MetricValue>
      </AggMetric>
    )}

    {theme.phaseStreakDays > 0 && (
      <AggMetric label="Phase">
        <MetricValue
          className={theme.phaseStreakDays >= 10 ? "text-violet-400" : theme.phaseStreakDays >= 5 ? "text-indigo-400" : "text-slate-400"}
          title={`${theme.phaseStreakDays} consecutive days in the same market phase`}
        >
          {theme.phaseStreakDays}d
        </MetricValue>
      </AggMetric>
    )}

    {theme.volatility30d != null && (
      <AggMetric label="Vol 30d">
        <MetricValue
          className={theme.volatility30d > 0.20 ? "text-red-400" : theme.volatility30d > 0.12 ? "text-amber-400" : "text-emerald-400"}
          title="30-day annualized composite score volatility"
        >
          {(theme.volatility30d * 100).toFixed(1)}%
        </MetricValue>
      </AggMetric>
    )}

    {theme.scorePercentile30d != null && (
      <AggMetric label="Pctile">
        <MetricValue
          className={
            theme.scorePercentile30d >= 80 ? "text-emerald-400"
            : theme.scorePercentile30d >= 50 ? "text-cyan-400"
            : theme.scorePercentile30d >= 25 ? "text-amber-400"
            : "text-red-400"
          }
          title="Score percentile rank over the last 30 days"
        >
          {Math.round(theme.scorePercentile30d)}p
        </MetricValue>
      </AggMetric>
    )}

    {theme.concentrationRisk != null && (
      <AggMetric label="Conc.Risk">
        <MetricValue
          className={theme.concentrationRisk > 0.70 ? "text-red-400" : theme.concentrationRisk > 0.45 ? "text-amber-400" : "text-emerald-400"}
          title="Concentration risk: how much of the theme is driven by a single constituent"
        >
          {Math.round(theme.concentrationRisk * 100)}
        </MetricValue>
      </AggMetric>
    )}

    <AggMetric label="Persist">
      <span
        data-testid="persistence-grade-badge"
        className={`text-base font-bold font-mono ${gradeColor(theme.persistenceGrade)}`}
        title={`Phase persistence: ${theme.persistenceScore}% of last 30 days in a strong phase (BREAKOUT/MOMENTUM/SETUP). Grade ${theme.persistenceGrade}`}
      >
        {theme.persistenceGrade}
      </span>
    </AggMetric>

    <AggMetric label="IQS">
      <span
        data-testid="iqs-grade-badge"
        className={`text-base font-bold font-mono ${gradeColor(theme.investmentQualityGrade)}`}
        title={`Investment Quality Score: ${theme.investmentQualityScore}/100 — signal quality (50%), value zone (20%), diversification (15%), volatility (15%). Grade ${theme.investmentQualityGrade}`}
      >
        {theme.investmentQualityGrade}
      </span>
    </AggMetric>
  </div>
);

export const ThemeHeaderCard = ({ theme }: { theme: ThemeDetail }) => {
  const watchGuidance = computeWatchGuidance(theme);
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-4 mb-4">
      <ThemeIdentity theme={theme} />
      <ThemeAggregateMetrics theme={theme} />
      <SignalDistributionBar constituents={theme.constituents} />
      <ConstituentScoreSpread constituents={theme.constituents} />
      {watchGuidance && (
        <div className="mt-3 pt-3 border-t border-slate-700/40">
          <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider mr-2">What to watch</span>
          <span className="text-[11px] text-slate-400 leading-relaxed">{watchGuidance}</span>
        </div>
      )}
    </div>
  );
};

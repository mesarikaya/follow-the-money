import Link from "next/link";
import { AlertDto, ThemeHistoryPoint, ThemeSummary } from "@/lib/api";

type OpportunityEntry = {
  theme: ThemeSummary;
  action: string;
  reason: string;
  priority: "HIGH" | "MED" | "LOW";
  actionColor: string;
};


export function ThemePlaybook({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  type PlaybookEntry = {
    theme: ThemeSummary;
    action: string;
    note: string;
    actionCls: string;
    priority: number;
  };

  const entries: PlaybookEntry[] = [];

  for (const t of themes) {
    if (t.compositeScore == null) continue;
    const score = t.compositeScore;
    const hist = historiesByThemeId[t.id] ?? [];
    const accel = t.compositeTrend5d != null && t.compositeTrend20d != null
      ? t.compositeTrend5d - t.compositeTrend20d : null;
    const delta5d = hist.length >= 6
      ? Math.round((hist[hist.length - 1].compositeScore - hist[hist.length - 6].compositeScore) * 100)
      : null;
    const phase = t.themePhase ?? "";
    const signal = t.dominantSignal;

    if (signal === "BUY" && phase === "BREAKOUT") {
      entries.push({
        theme: t, priority: 1,
        action: "ENTER",
        actionCls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/25",
        note: `Breakout phase: score ${Math.round(score * 100)}, momentum accelerating${accel != null && accel > 0 ? ` (+${Math.round(accel * 100)}pt acceleration)` : ""}. Primary entry zone — add on pullbacks to mid-60s.`,
      });
    } else if (signal === "BUY" && phase === "MOMENTUM") {
      entries.push({
        theme: t, priority: 2,
        action: "HOLD",
        actionCls: "text-cyan-300 bg-cyan-500/15 border-cyan-500/25",
        note: `Momentum phase: score ${Math.round(score * 100)}, trend sustained. Hold existing positions — add only on confirmed dips.`,
      });
    } else if (signal === "BUY" && (phase === "HOLDING" || phase === "FADING")) {
      entries.push({
        theme: t, priority: 3,
        action: "WATCH",
        actionCls: "text-amber-300 bg-amber-500/15 border-amber-500/25",
        note: `${phase} phase: score ${Math.round(score * 100)}${delta5d != null && delta5d < 0 ? `, -${Math.abs(delta5d)}pt in 5d` : ""}. Monitor closely — momentum waning, tighten stops.`,
      });
    } else if (signal === "WATCH" && (phase === "SETUP" || phase === "BUILDING")) {
      entries.push({
        theme: t, priority: 4,
        action: "PREPARE",
        actionCls: "text-sky-300 bg-sky-500/15 border-sky-500/25",
        note: `${phase} phase: score ${Math.round(score * 100)}${delta5d != null && delta5d > 0 ? `, +${delta5d}pt in 5d` : ""}. Approaching BUY zone — build watchlist, set ${Math.round((0.65 - score) * 100)}pt alert.`,
      });
    } else if (signal === "REDUCE" || (signal === "HOLD" && phase === "WEAK")) {
      entries.push({
        theme: t, priority: 5,
        action: "REDUCE",
        actionCls: "text-red-300 bg-red-500/15 border-red-500/25",
        note: `Score ${Math.round(score * 100)} in ${phase || "WEAK"} territory. Exit remaining positions, avoid new entries.`,
      });
    }
  }

  if (entries.length === 0) return null;
  entries.sort((a, b) => a.priority - b.priority);

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Theme Playbook</span>
        <span className="text-[10px] text-slate-600 font-mono">action-oriented guidance per theme</span>
      </div>
      <div className="divide-y divide-slate-700/20">
        {entries.map(({ theme: t, action, note, actionCls }) => (
          <div key={t.id} className="flex items-start gap-3 px-4 py-2.5">
            <span className={`shrink-0 mt-0.5 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border w-14 text-center ${actionCls}`}>
              {action}
            </span>
            <Link href={`/themes/${t.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors shrink-0 w-36 pt-0.5 truncate">
              {t.name}
            </Link>
            <span className="text-[10px] text-slate-400 leading-relaxed">{note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PreBuySetupPanel({ themes }: { themes: ThemeSummary[] }) {
  const setups = themes.filter(
    t =>
      t.phaseTransitionSignal === "APPROACHING_BUY" ||
      (t.phaseTransitionSignal == null &&
        t.compositeScore != null &&
        t.compositeScore >= 0.50 &&
        t.compositeScore < 0.65 &&
        t.dominantSignal !== "BUY" &&
        t.compositeTrend5d != null &&
        t.compositeTrend20d != null &&
        t.compositeTrend5d > t.compositeTrend20d)
  );
  if (setups.length === 0) return null;

  return (
    <div className="bg-cyan-900/10 border border-cyan-700/30 rounded-lg px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Pre-Buy Setups</span>
        <span className="text-[10px] font-mono text-cyan-600">— approaching BUY, momentum accelerating</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {setups.map(t => {
          const score = Math.round((t.compositeScore ?? 0) * 100);
          const delta = ((t.compositeTrend5d ?? 0) - (t.compositeTrend20d ?? 0)) * 100;
          return (
            <Link
              key={t.id}
              href={`/themes/${t.id}`}
              className="flex items-center gap-1.5 bg-slate-800/60 border border-cyan-700/30 rounded px-2 py-1 hover:border-cyan-500/50 hover:bg-slate-800 transition-all"
            >
              <span className="text-[10px] font-semibold text-slate-200">{t.name}</span>
              <span className="text-[10px] font-mono text-cyan-400">{score}</span>
              <span className="text-[9px] font-mono text-emerald-400" title={`5d accelerating +${delta.toFixed(1)}pt vs 20d`}>
                ⬆+{delta.toFixed(1)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeTippingPoints({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const BUY_ZONE = 0.65;
  const HOLD_ZONE = 0.50;

  const approaching: { theme: ThemeSummary; score: number; delta5d: number | null; gap: number }[] = [];
  const atRisk: { theme: ThemeSummary; score: number; delta5d: number | null; margin: number }[] = [];
  const recovering: { theme: ThemeSummary; score: number; delta5d: number | null; gap: number }[] = [];

  for (const t of themes) {
    if (t.compositeScore == null) continue;
    const hist = historiesByThemeId[t.id] ?? [];
    const delta5d = hist.length >= 6
      ? (hist[hist.length - 1].compositeScore - hist[hist.length - 6].compositeScore)
      : null;

    const score = t.compositeScore;

    if (t.phaseTransitionSignal === "APPROACHING_BUY") {
      approaching.push({ theme: t, score, delta5d, gap: BUY_ZONE - score });
    } else if (t.phaseTransitionSignal === "BREAKOUT_AT_RISK") {
      atRisk.push({ theme: t, score, delta5d, margin: score - BUY_ZONE });
    } else if (t.phaseTransitionSignal === "EARLY_RECOVERY") {
      recovering.push({ theme: t, score, delta5d, gap: HOLD_ZONE - score });
    } else if (t.phaseTransitionSignal === "DISTRIBUTION") {
      atRisk.push({ theme: t, score, delta5d, margin: score - BUY_ZONE });
    } else if (score >= 0.58 && score < BUY_ZONE && (delta5d == null || delta5d >= -0.02)) {
      approaching.push({ theme: t, score, delta5d, gap: BUY_ZONE - score });
    } else if (score >= BUY_ZONE && score <= 0.72 && delta5d != null && delta5d < -0.02) {
      atRisk.push({ theme: t, score, delta5d, margin: score - BUY_ZONE });
    } else if (score >= 0.38 && score < HOLD_ZONE && delta5d != null && delta5d > 0.01) {
      recovering.push({ theme: t, score, delta5d, gap: HOLD_ZONE - score });
    }
  }

  approaching.sort((a, b) => a.gap - b.gap);
  atRisk.sort((a, b) => a.margin - b.margin);
  recovering.sort((a, b) => b.delta5d! - a.delta5d!);

  if (approaching.length === 0 && atRisk.length === 0 && recovering.length === 0) return null;

  const renderRow = (
    t: ThemeSummary,
    score: number,
    delta5d: number | null,
    tag: string,
    tagCls: string,
    note: string,
  ) => {
    const pct = Math.round(score * 100);
    const barClr = score >= BUY_ZONE ? "bg-emerald-500" : score >= HOLD_ZONE ? "bg-cyan-500" : "bg-amber-500";
    return (
      <div key={t.id} className="flex items-center gap-3 px-4 py-2 border-t border-slate-700/20 first:border-t-0">
        <span className={`shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded border ${tagCls}`}>{tag}</span>
        <Link href={`/themes/${t.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors w-40 truncate shrink-0">
          {t.name}
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barClr}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[10px] font-mono tabular-nums text-slate-300">{pct}</span>
        </div>
        {delta5d != null && (
          <span className={`text-[10px] font-mono tabular-nums shrink-0 ${delta5d > 0 ? "text-emerald-400" : delta5d < 0 ? "text-red-400" : "text-slate-500"}`}>
            {delta5d > 0 ? "+" : ""}{Math.round(delta5d * 100)}pt
          </span>
        )}
        <span className="text-[10px] text-slate-500 truncate">{note}</span>
      </div>
    );
  };

  return (
    <div className="mb-4 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Tipping Points</span>
        <span className="text-[10px] text-slate-600 font-mono">themes at key signal thresholds</span>
      </div>
      <div className="divide-y divide-slate-700/10">
        {approaching.slice(0, 3).map(({ theme: t, score, delta5d, gap }) =>
          renderRow(t, score, delta5d, "ENTRY", "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
            `${Math.round(gap * 100)}pt below BUY — ${delta5d != null && delta5d > 0 ? "rising" : "watch for breakout"}`)
        )}
        {atRisk.slice(0, 3).map(({ theme: t, score, delta5d, margin }) =>
          renderRow(t, score, delta5d, "AT RISK", "text-amber-400 bg-amber-500/10 border-amber-500/20",
            `${Math.round(margin * 100)}pt above BUY floor — momentum fading`)
        )}
        {recovering.slice(0, 2).map(({ theme: t, score, delta5d, gap }) =>
          renderRow(t, score, delta5d, "RECOVERY", "text-sky-400 bg-sky-500/10 border-sky-500/20",
            `${Math.round(gap * 100)}pt below HOLD — momentum turning`)
        )}
      </div>
    </div>
  );
}

export function TopOpportunitiesPanel({ themes }: { themes: ThemeSummary[] }) {
  const opportunities: OpportunityEntry[] = [];

  for (const t of themes) {
    const score = t.compositeScore ?? 0;
    const accel = (t.compositeTrend5d ?? 0) - (t.compositeTrend20d ?? 0);
    const phase = t.themePhase;

    if (phase === "BREAKOUT" && t.dominantSignal === "BUY") {
      opportunities.push({
        theme: t,
        action: "ENTER / ADD",
        reason: `BREAKOUT · score ${Math.round(score * 100)} · accel +${(accel * 100).toFixed(1)}pt`,
        priority: "HIGH",
        actionColor: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30",
      });
    } else if (phase === "SETUP" && score >= 0.55 && accel > 0.003) {
      const ptsNeeded = Math.round((0.65 - score) * 100);
      opportunities.push({
        theme: t,
        action: "ACCUMULATE",
        reason: `SETUP · ${ptsNeeded}pt from BUY · momentum accelerating`,
        priority: "MED",
        actionColor: "text-sky-300 bg-sky-500/15 border-sky-500/30",
      });
    } else if (phase === "DISTRIBUTE" && t.dominantSignal === "BUY") {
      opportunities.push({
        theme: t,
        action: "TRIM / EXIT",
        reason: `DISTRIBUTING · score ${Math.round(score * 100)} but flow ${(t.flow20d ?? 0).toFixed(1)}σ`,
        priority: "HIGH",
        actionColor: "text-orange-300 bg-orange-500/15 border-orange-500/30",
      });
    } else if (phase === "FADING" && t.dominantSignal !== "REDUCE") {
      opportunities.push({
        theme: t,
        action: "REDUCE",
        reason: `FADING · trend turning negative · avoid new entries`,
        priority: "MED",
        actionColor: "text-amber-300 bg-amber-500/15 border-amber-500/30",
      });
    }
  }

  if (opportunities.length === 0) return null;

  const sorted = [
    ...opportunities.filter(o => o.priority === "HIGH"),
    ...opportunities.filter(o => o.priority === "MED"),
  ].slice(0, 5);

  return (
    <div className="bg-slate-900/70 border border-slate-700/60 rounded-lg overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center gap-2">
        <span className="text-[10px] font-mono text-white uppercase tracking-wider">Trade Opportunities</span>
        <span className="text-[10px] font-mono text-slate-600">· phase-based signals</span>
        <span className="ml-auto text-[9px] font-mono text-slate-700">{sorted.length} active</span>
      </div>
      <div className="divide-y divide-slate-800/60">
        {sorted.map(o => (
          <div key={o.theme.id} className="px-3 py-2 flex items-center gap-3 hover:bg-slate-800/30 transition-colors">
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${o.actionColor}`}>
              {o.action}
            </span>
            <Link href={`/themes/${o.theme.id}`} className="text-[11px] font-semibold text-slate-200 hover:text-cyan-300 transition-colors truncate">
              {o.theme.name}
            </Link>
            <span className="text-[9px] font-mono text-slate-500 ml-auto shrink-0 hidden sm:block">
              {o.reason}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ThemeNarrative({ themes }: { themes: ThemeSummary[] }) {
  if (themes.length === 0) return null;

  const buy = themes.filter(t => t.dominantSignal === "BUY");
  const watch = themes.filter(t => t.dominantSignal === "WATCH");
  const reduce = themes.filter(t => t.dominantSignal === "REDUCE");

  const sorted = [...themes].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
  const topTheme = sorted[0];
  const bottomTheme = sorted[sorted.length - 1];

  const rising = themes
    .filter(t => (t.compositeTrend20d ?? 0) > 0.005)
    .sort((a, b) => (b.compositeTrend20d ?? 0) - (a.compositeTrend20d ?? 0));
  const falling = themes
    .filter(t => (t.compositeTrend20d ?? 0) < -0.005)
    .sort((a, b) => (a.compositeTrend20d ?? 0) - (b.compositeTrend20d ?? 0));

  const sentences: string[] = [];

  if (buy.length > 0) {
    const names = buy.map(t => t.name).join(", ");
    sentences.push(`${buy.length === 1 ? buy[0].name : `${buy.length} themes (${names})`} ${buy.length === 1 ? "is" : "are"} in full BUY.`);
  }
  if (watch.length > 0) {
    sentences.push(`${watch.map(t => t.name).join(", ")} ${watch.length === 1 ? "is" : "are"} building toward BUY.`);
  }
  if (reduce.length > 0) {
    sentences.push(`${reduce.map(t => t.name).join(", ")} ${reduce.length === 1 ? "is" : "are"} in REDUCE.`);
  }
  if (rising.length > 0 && falling.length > 0) {
    sentences.push(`${rising[0].name} is the fastest accelerating (+${Math.round((rising[0].compositeTrend20d ?? 0) * 1000)}‰/day); ${falling[0].name} is decelerating fastest.`);
  } else if (rising.length > 0) {
    sentences.push(`${rising[0].name} is the strongest momentum play right now.`);
  }
  if (topTheme && bottomTheme && topTheme.id !== bottomTheme.id) {
    const spread = Math.round(((topTheme.compositeScore ?? 0) - (bottomTheme.compositeScore ?? 0)) * 100);
    if (spread > 15) {
      sentences.push(`${spread}pt spread between ${topTheme.name} and ${bottomTheme.name} — widest divergence in the current cohort.`);
    }
  }

  if (sentences.length === 0) return null;

  return (
    <div className="bg-slate-800/30 border border-slate-700/40 rounded-lg px-4 py-3 mb-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Market Narrative</div>
      <p className="text-slate-300 text-xs leading-relaxed">{sentences.join(" ")}</p>
    </div>
  );
}


export const RULE_LABELS: Record<string, string> = {
  theme_5d_acceleration:            "5d Accel",
  theme_dominant_signal_transition: "Signal Shift",
  theme_momentum_surge:             "Mom. Surge",
  theme_momentum_collapse:          "Mom. Collapse",
  theme_distribute_warning:         "Distribution",
  theme_phase_breakout_entry:       "Breakout Entry",
  theme_setup_acceleration:         "Pre-Breakout",
  theme_failed_breakout:            "Failed Breakout",
  theme_phase_fading:               "Phase Fading",
  theme_momentum_exhaustion:        "Momentum Exhaustion",
  theme_recovery_signal:            "Recovery Signal",
  theme_strong_breakout_confirmation: "Strong Breakout",
  pre_buy_flow_surge:               "Pre-Buy Flow",
};

export const SEVERITY_CONFIG: Record<string, { badge: string; dot: string }> = {
  ACTION:  { badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25", dot: "bg-emerald-400" },
  WARNING: { badge: "bg-amber-500/15 text-amber-400 border border-amber-500/25",      dot: "bg-amber-400"   },
  URGENT:  { badge: "bg-red-500/15 text-red-400 border border-red-500/25",            dot: "bg-red-400"     },
  INFO:    { badge: "bg-slate-700/60 text-slate-400 border border-slate-600/40",      dot: "bg-slate-500"   },
};

export function ActiveRotationBanner({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) {
  const scored = themes.filter(t => t.compositeScore != null);
  if (scored.length < 2) return null;

  // Prefer a pair where one is rising and the other falling (confirmed rotation)
  const rising = scored.filter(t => (t.compositeTrend20d ?? 0) > 0.002);
  const falling = scored.filter(t => (t.compositeTrend20d ?? 0) < -0.002);

  let leader = scored[0];
  let lagger = scored[scored.length - 1];
  let isRotating = false;

  if (rising.length > 0 && falling.length > 0) {
    // Find the rising+falling pair with the largest composite divergence
    let maxDiv = -1;
    for (const r of rising) {
      for (const f of falling) {
        const div = (r.compositeScore ?? 0) - (f.compositeScore ?? 0);
        if (div > maxDiv) { maxDiv = div; leader = r; lagger = f; }
      }
    }
    isRotating = true;
  } else {
    // No confirmed rotation — just show the widest absolute gap
    const byScore = [...scored].sort((a, b) => (b.compositeScore ?? 0) - (a.compositeScore ?? 0));
    leader = byScore[0];
    lagger = byScore[byScore.length - 1];
  }

  const divergence = (leader.compositeScore ?? 0) - (lagger.compositeScore ?? 0);
  if (divergence < 0.12) return null;

  return (
    <div className={`rounded-lg px-4 py-2.5 mb-4 flex items-center justify-between gap-4 ${
      isRotating
        ? "bg-emerald-900/20 border border-emerald-700/40"
        : "bg-slate-800/50 border border-slate-700/60"
    }`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0">
          Rotation
        </span>
        <Link href={`/themes/${leader.id}`} className="text-[12px] font-semibold text-emerald-400 hover:text-emerald-300 truncate">
          {leader.name}
        </Link>
        <span className="text-[10px] text-slate-500 shrink-0">
          {isRotating ? "outpacing" : "ahead of"}
        </span>
        <Link href={`/themes/${lagger.id}`} className="text-[12px] font-medium text-red-400 hover:text-red-300 truncate">
          {lagger.name}
        </Link>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <DualSparkline
          leaderHistory={historiesByThemeId[leader.id] ?? []}
          laggerHistory={historiesByThemeId[lagger.id] ?? []}
        />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[13px] font-bold font-mono text-white">
            +{Math.round(divergence * 100)}pt
          </span>
          {isRotating && (
            <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
              rotating ↑↓
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function RotationMomentumStrip({ themes }: { themes: ThemeSummary[] }) {
  const withVelocity = themes.filter(t => t.compositeTrend20d != null);
  if (withVelocity.length < 2) return null;

  const sorted = [...withVelocity].sort(
    (a, b) => (b.compositeTrend20d ?? 0) - (a.compositeTrend20d ?? 0)
  );
  const rising = sorted.filter(t => (t.compositeTrend20d ?? 0) > 0.003).slice(0, 3);
  const falling = sorted.filter(t => (t.compositeTrend20d ?? 0) < -0.003).reverse().slice(0, 3);

  if (rising.length === 0 && falling.length === 0) return null;

  const velLabel = (v: number) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}pt`;

  return (
    <div className="bg-slate-800/50 border border-slate-700/60 rounded-lg p-3 mb-4">
      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
        Rotation Momentum · 20-day velocity
      </div>
      <div className="grid grid-cols-2 gap-3">
        {rising.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-emerald-400 mb-1.5">↑ Accelerating</div>
            <div className="space-y-1">
              {rising.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <Link href={`/themes/${t.id}`} className="text-[11px] text-slate-300 hover:text-white truncate">
                    {t.name}
                  </Link>
                  <span className="text-[10px] font-mono text-emerald-400 ml-2 shrink-0">
                    {velLabel(t.compositeTrend20d!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {falling.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold text-red-400 mb-1.5">↓ Decelerating</div>
            <div className="space-y-1">
              {falling.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <Link href={`/themes/${t.id}`} className="text-[11px] text-slate-300 hover:text-white truncate">
                    {t.name}
                  </Link>
                  <span className="text-[10px] font-mono text-red-400 ml-2 shrink-0">
                    {velLabel(t.compositeTrend20d!)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ThemeEventsFeed({ events }: { events: AlertDto[] }) {
  if (events.length === 0) return null;

  const STATUS_STYLE = {
    ACTIVE:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
    RESOLVED:     "text-slate-500 bg-slate-800/40 border-slate-700/30",
    ACKNOWLEDGED: "text-slate-600 bg-slate-800/30 border-slate-700/20",
  };
  const STATUS_LABEL = { ACTIVE: "active", RESOLVED: "resolved", ACKNOWLEDGED: "ack" };

  return (
    <div className="mb-5 bg-slate-800/40 border border-slate-700/40 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-700/30 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">Event Log</span>
        <span className="text-[10px] font-mono text-slate-600">{events.length} recent</span>
      </div>
      <div className="divide-y divide-slate-700/20 max-h-64 overflow-y-auto">
        {events.map(e => {
          const subject = e.themeId ?? e.categoryId ?? "—";
          const ruleLabel = RULE_LABELS[e.ruleId] ?? e.ruleId;
          const ts = new Date(e.createdAt);
          const timeStr = ts.toLocaleDateString(undefined, { month: "short", day: "numeric" })
            + " " + ts.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
          const severityStyle = SEVERITY_CONFIG[e.severity] ?? SEVERITY_CONFIG.INFO;
          const statusStyle = STATUS_STYLE[e.status] ?? STATUS_STYLE.ACKNOWLEDGED;
          return (
            <div key={e.id} className={`flex items-start gap-2 px-4 py-2 text-[11px] ${e.status !== "ACTIVE" ? "opacity-50" : ""}`}>
              <span className="font-mono text-slate-600 shrink-0 w-24 pt-0.5">{timeStr}</span>
              <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1 ${severityStyle.dot}`} />
              <span className="font-mono font-semibold text-slate-300 shrink-0 w-28 truncate pt-0.5">
                {e.themeId ? (
                  <Link href={`/themes/${e.themeId}`} className="hover:text-cyan-400 transition-colors">{subject}</Link>
                ) : subject}
              </span>
              <span className="text-slate-500 shrink-0 pt-0.5">{ruleLabel}</span>
              <span className={`ml-auto shrink-0 px-1.5 py-0.5 rounded border text-[9px] font-mono ${statusStyle}`}>
                {STATUS_LABEL[e.status]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeAlertFeed({
  alerts,
  themes,
}: {
  alerts: AlertDto[];
  themes: ThemeSummary[];
}) {
  const themeAlerts = alerts
    .filter(a => a.themeId != null && a.status === "ACTIVE")
    .slice(0, 5);
  if (themeAlerts.length === 0) return null;

  const themeNameById = Object.fromEntries(themes.map(t => [t.id, t.name]));

  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-lg overflow-hidden mb-4">
      <div className="px-3 py-2 border-b border-slate-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active Theme Alerts</span>
        </div>
        <Link href="/alerts" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 transition-colors">
          all alerts →
        </Link>
      </div>
      <div className="divide-y divide-slate-800/60">
        {themeAlerts.map(alert => {
          const sev = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.INFO;
          const ruleLabel = RULE_LABELS[alert.ruleId] ?? alert.ruleId;
          const themeName = alert.themeId ? (themeNameById[alert.themeId] ?? alert.themeId) : null;
          return (
            <div key={alert.id} className="px-3 py-2 flex items-start gap-3 hover:bg-slate-800/30 transition-colors">
              <span className={`mt-0.5 w-1 h-1 rounded-full shrink-0 ${sev.dot}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${sev.badge}`}>{alert.severity}</span>
                  <span className="text-[9px] font-mono text-slate-600 px-1.5 py-0.5 rounded bg-slate-800/60">{ruleLabel}</span>
                  {themeName && alert.themeId && (
                    <Link
                      href={`/themes/${alert.themeId}`}
                      className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors truncate"
                    >
                      {themeName}
                    </Link>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-1">{alert.message}</p>
              </div>
              <span className="text-[9px] font-mono text-slate-700 shrink-0 mt-0.5">
                {new Date(alert.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DualSparkline({
  leaderHistory,
  laggerHistory,
}: {
  leaderHistory: ThemeHistoryPoint[];
  laggerHistory: ThemeHistoryPoint[];
}) {
  if (leaderHistory.length < 2 || laggerHistory.length < 2) return null;
  const W = 96, H = 28;

  const allVals = [...leaderHistory.map(h => h.compositeScore), ...laggerHistory.map(h => h.compositeScore)];
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const range = maxV - minV || 0.01;

  const toPoints = (hist: ThemeHistoryPoint[]) =>
    hist.map((h, i) => {
      const x = (i / (hist.length - 1)) * W;
      const y = H - ((h.compositeScore - minV) / range) * (H - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="opacity-80 shrink-0">
      <polyline points={toPoints(laggerHistory)} fill="none" stroke="#f87171" strokeWidth="1.2" strokeLinecap="round" />
      <polyline points={toPoints(leaderHistory)} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

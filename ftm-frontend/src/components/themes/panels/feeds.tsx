import Link from "next/link";
import { AlertDto, ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import { DualSparkline } from "@/components/themes/panels/plots";

/**
 * What just happened: the rotation banner and momentum strip, and the two alert feeds.
 */


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

export const ActiveRotationBanner = ({
  themes,
  historiesByThemeId,
}: {
  themes: ThemeSummary[];
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
}) => {
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

export const RotationMomentumStrip = ({ themes }: { themes: ThemeSummary[] }) => {
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

export const ThemeEventsFeed = ({ events }: { events: AlertDto[] }) => {
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

export const ThemeAlertFeed = ({
  alerts,
  themes,
}: {
  alerts: AlertDto[];
  themes: ThemeSummary[];
}) => {
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

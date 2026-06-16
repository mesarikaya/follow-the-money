"use client";

import { useEffect, useState } from "react";
import { fetchAlertRuleStats } from "@/lib/api";

const RULE_SHORT_LABELS: Record<string, string> = {
  rrg_transition:                    "RRG Transition",
  composite_breakout:                "Composite Breakout",
  composite_breakdown:               "Composite Breakdown",
  macro_regime_shift:                "Macro Regime Shift",
  rs_accel_crossover:                "RS Accel Crossover",
  persistence_low:                   "Persistence Low",
  breadth_velocity_accel:            "Breadth Accel",
  breadth_velocity_decel:            "Breadth Decel",
  trade_signal_buy:                  "Trade Signal BUY",
  trade_signal_reduce:               "Trade Signal REDUCE",
  score_approaching_buy:             "Approaching BUY",
  score_approaching_reduce:          "Approaching REDUCE",
  high_conviction_buy:               "High Conviction BUY",
  high_conviction_cluster:           "Bull Confluence Cluster",
  high_conviction_reduce_cluster:    "Bear Conviction Cluster",
  signal_deterioration:              "Signal Deterioration",
  flow_surge:                        "Flow Surge",
  rs_aligned_bull:                   "RS Aligned Bull",
  rs_aligned_bear:                   "RS Aligned Bear",
  pre_buy_flow_surge:                "Pre-Buy Flow Surge",
  rs_breadth_bull:                   "RS Breadth Bull",
  rs_breadth_bear:                   "RS Breadth Bear",
  rrg_rs_divergence:                 "RRG-RS Divergence",
  score_percentile_extreme:          "Score Percentile Extreme",
  score_velocity:                    "Score Velocity",
  multi_alert_bull_confluence:       "Bull Multi-Alert",
  cross_horizon_rs_divergence:       "Cross-Horizon RS Div",
  macro_sector_mismatch:             "Macro-Sector Mismatch",
  sub_sector_breadth_divergence:     "Sub-Sector Breadth Div",
  sub_sector_bull_confluence:        "Sub-Sector Bull Confl",
  theme_dominant_signal_transition:  "Theme Signal Transition",
  theme_momentum_surge:              "Theme Momentum Surge",
  theme_momentum_collapse:           "Theme Momentum Collapse",
  theme_5d_acceleration:             "Theme 5d Accel",
  theme_distribute_warning:          "Theme Distribute Warning",
  theme_phase_breakout_entry:        "Theme Breakout Entry",
  theme_failed_breakout:             "Failed Breakout",
  theme_setup_acceleration:          "Theme Setup Accel",
  theme_phase_fading:                "Theme Phase Fading",
  theme_momentum_exhaustion:         "Momentum Exhaustion",
  theme_recovery_signal:             "Theme Recovery",
  theme_strong_breakout_confirmation:"Strong Breakout Confirmed",
  theme_peer_divergence:             "Peer Divergence",
  theme_score_price_divergence:      "Score-Price Divergence",
};

const MAX_BAR_ITEMS = 15;

export default function AlertRuleActivityPanel({ days = 30 }: { days?: number }) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetchAlertRuleStats(days)
      .then(setStats)
      .catch(() => setStats({}));
  }, [days]);

  if (stats === null) {
    return (
      <section className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
        <div className="h-4 bg-slate-700/40 rounded w-32 animate-pulse" />
      </section>
    );
  }

  const sorted = Object.entries(stats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, MAX_BAR_ITEMS);

  if (sorted.length === 0) return null;

  const maxCount = sorted[0][1];

  return (
    <section data-testid="alert-rule-activity-panel" className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-200 mb-1">Rule Activity</h2>
      <p className="text-[10px] text-slate-500 mb-4">Alert fires per rule — last {days} days</p>
      <div className="space-y-1.5">
        {sorted.map(([ruleId, count]) => {
          const label = RULE_SHORT_LABELS[ruleId] ?? ruleId;
          const barPct = Math.round((count / maxCount) * 100);
          const isTheme = ruleId.startsWith("theme_");
          return (
            <div key={ruleId} className="flex items-center gap-2 text-xs">
              <span className="w-44 text-slate-400 truncate shrink-0">{label}</span>
              <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${isTheme ? "bg-indigo-500/70" : "bg-sky-500/70"}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className="w-6 text-right text-slate-400 tabular-nums">{count}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] text-slate-600">
        <span className="text-sky-400">■</span> Sector/macro &nbsp;
        <span className="text-indigo-400">■</span> Theme
      </p>
    </section>
  );
}

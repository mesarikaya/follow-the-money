"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertDto, fetchAlerts, acknowledgeAlert, bulkDismissAlerts } from "@/lib/api";

const RULE_SHORT: Record<string, string> = {
  rrg_transition:           "RRG",
  composite_breakout:       "Breakout",
  composite_breakdown:      "Breakdown",
  macro_regime_shift:       "Regime",
  rs_accel_crossover:       "RS Cross",
  persistence_low:          "Persist↓",
  breadth_velocity_accel:   "Breadth↑",
  breadth_velocity_decel:   "Breadth↓",
  trade_signal_buy:         "BUY",
  trade_signal_reduce:      "REDUCE",
  score_approaching_buy:    "Pre-BUY",
  score_approaching_reduce: "Pre-REDUCE",
  flow_surge:               "Flow⬆",
  signal_deterioration:     "Deteriorating",
  high_conviction_buy:      "High-C BUY",
  high_conviction_reduce_cluster: "RISK-OFF Cluster",
  rs_aligned_bull:          "RS Aligned⊕",
  rs_aligned_bear:          "RS Bear⊖",
  rs_breadth_bull:          "RS Breadth⊕",
  rs_breadth_bear:          "RS Breadth⊖",
  pre_buy_flow_surge:       "Pre-BUY Flow",
  rrg_rs_divergence:        "RRG÷RS",
  score_percentile_extreme:      "Pct Extreme",
  score_velocity:                "Velocity",
  multi_alert_bull_confluence:   "Multi-Signal",
  cross_horizon_rs_divergence:   "RS÷Horizon",
};

const SEV_STYLES: Record<string, { strip: string; badge: string; dot: string }> = {
  URGENT:  { strip: "border-red-600/70 bg-red-950/40",   badge: "bg-red-800/90 text-red-200 border border-red-600/60",     dot: "bg-red-300"    },
  ACTION:  { strip: "border-red-700/60 bg-red-950/30",   badge: "bg-red-900/80 text-red-300 border border-red-700/50",     dot: "bg-red-400"    },
  WARNING: { strip: "border-amber-700/50 bg-amber-950/20", badge: "bg-amber-900/70 text-amber-300 border border-amber-700/40", dot: "bg-amber-400"  },
  INFO:    { strip: "border-blue-700/40 bg-blue-950/15",  badge: "bg-blue-900/60 text-blue-300 border border-blue-700/40",   dot: "bg-blue-400"   },
};

export default function ActiveAlertsStrip() {
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [dismissing, setDismissing] = useState<number | null>(null);
  const [bulkDismissing, setBulkDismissing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      const active = (data.alerts ?? [])
        .filter((a: AlertDto) => a.status === "ACTIVE")
        .sort((a: AlertDto, b: AlertDto) => {
          const order: Record<string, number> = { URGENT: 0, ACTION: 1, WARNING: 2, INFO: 3 };
          return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
        });
      setAlerts(active);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id: number) => {
    setDismissing(id);
    try {
      await acknowledgeAlert(id);
      await load();
    } catch {} finally {
      setDismissing(null);
    }
  };

  const dismissAll = async () => {
    setBulkDismissing(true);
    try {
      await bulkDismissAlerts();
      await load();
    } catch {} finally {
      setBulkDismissing(false);
    }
  };

  if (alerts.length === 0) return null;

  const topSeverity = alerts[0].severity;
  const styles = SEV_STYLES[topSeverity] ?? SEV_STYLES.INFO;
  const visibleAlerts = collapsed ? [] : alerts.slice(0, 5);

  return (
    <div className={`rounded-xl border overflow-hidden ${styles.strip}`}>
      <div className="px-4 py-2 flex items-center gap-3 border-b border-white/5">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${styles.dot}`} />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          {alerts.length} Active Alert{alerts.length > 1 ? "s" : ""}
        </span>
        <Link href="/alerts" className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors ml-1">
          See all →
        </Link>
        {alerts.length > 1 && (
          <button
            onClick={dismissAll}
            disabled={bulkDismissing}
            className="text-[10px] text-slate-600 hover:text-slate-400 border border-slate-700/50 hover:border-slate-600 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
          >
            {bulkDismissing ? "…" : "Dismiss all"}
          </button>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          {collapsed ? "▼ expand" : "▲ collapse"}
        </button>
      </div>

      {!collapsed && (
        <div className="divide-y divide-white/5">
          {visibleAlerts.map(alert => {
            const sev = SEV_STYLES[alert.severity] ?? SEV_STYLES.INFO;
            return (
              <div key={alert.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${sev.badge}`}>
                  {alert.severity}
                </span>
                {alert.categoryId && (
                  <span className="font-mono text-cyan-400 font-medium shrink-0 text-[11px]">{alert.categoryId}</span>
                )}
                <span className="text-slate-500 shrink-0 text-[10px]">{RULE_SHORT[alert.ruleId] ?? alert.ruleId}</span>
                <span className="text-slate-300 flex-1 truncate">{alert.message}</span>
                <button
                  onClick={() => dismiss(alert.id)}
                  disabled={dismissing === alert.id}
                  className="shrink-0 text-[10px] text-slate-600 hover:text-slate-400 border border-slate-700 hover:border-slate-500 px-2 py-0.5 rounded transition-colors disabled:opacity-40"
                >
                  {dismissing === alert.id ? "…" : "Dismiss"}
                </button>
              </div>
            );
          })}
          {alerts.length > 5 && (
            <div className="px-4 py-1.5 text-[10px] text-slate-600 text-center">
              +{alerts.length - 5} more —{" "}
              <Link href="/alerts" className="text-slate-500 hover:text-slate-300">view all on Alerts page</Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

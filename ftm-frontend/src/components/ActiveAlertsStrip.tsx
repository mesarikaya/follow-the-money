"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AlertDto } from "@/lib/api";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

const RULE_SHORT: Record<string, string> = {
  rrg_transition:      "RRG",
  composite_breakout:  "Breakout",
  composite_breakdown: "Breakdown",
  macro_regime_shift:  "Regime",
  rs_accel_crossover:  "RS Cross",
};

const SEV_STYLES: Record<string, { strip: string; badge: string; dot: string }> = {
  ACTION:  { strip: "border-red-700/60 bg-red-950/30",   badge: "bg-red-900/80 text-red-300 border border-red-700/50",     dot: "bg-red-400"    },
  WARNING: { strip: "border-amber-700/50 bg-amber-950/20", badge: "bg-amber-900/70 text-amber-300 border border-amber-700/40", dot: "bg-amber-400"  },
  INFO:    { strip: "border-blue-700/40 bg-blue-950/15",  badge: "bg-blue-900/60 text-blue-300 border border-blue-700/40",   dot: "bg-blue-400"   },
};

export default function ActiveAlertsStrip() {
  const [alerts, setAlerts] = useState<AlertDto[]>([]);
  const [dismissing, setDismissing] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/api/v1/alerts`);
      if (!res.ok) return;
      const data = await res.json();
      const active = (data.alerts ?? [])
        .filter((a: AlertDto) => a.status === "ACTIVE")
        .sort((a: AlertDto, b: AlertDto) => {
          const order = { ACTION: 0, WARNING: 1, INFO: 2 };
          return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
        });
      setAlerts(active);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismiss = async (id: number) => {
    setDismissing(id);
    try {
      await fetch(`${BACKEND}/api/v1/alerts/${id}/acknowledge`, { method: "POST" });
      await load();
    } catch {} finally {
      setDismissing(null);
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

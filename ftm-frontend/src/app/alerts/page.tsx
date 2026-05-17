"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAlerts, acknowledgeAlert, AlertsResponse, AlertDto } from "@/lib/api";

const SEVERITY_STYLES: Record<string, string> = {
  ACTION:  "bg-red-500/10 border-red-500/40 text-red-400",
  WARNING: "bg-amber-500/10 border-amber-500/40 text-amber-400",
  INFO:    "bg-blue-500/10 border-blue-500/40 text-blue-400",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:       "bg-red-500/20 text-red-300",
  ACKNOWLEDGED: "bg-slate-500/20 text-slate-400",
  RESOLVED:     "bg-emerald-500/20 text-emerald-400",
};

const RULE_LABELS: Record<string, string> = {
  rrg_transition:     "Rotation Graph Transition",
  composite_breakout: "Composite Breakout",
  macro_regime_shift: "Macro Regime Shift",
  flow_inflow_5d:     "Flow Inflow (5d)",
  flow_inflow_10d:    "Flow Inflow (10d)",
  flow_inflow_20d:    "Flow Inflow (20d)",
  flow_outflow_5d:    "Flow Outflow (5d)",
  flow_outflow_10d:   "Flow Outflow (10d)",
  flow_outflow_20d:   "Flow Outflow (20d)",
};

function formatAlertTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export default function AlertsPage() {
  const [alertsResponse, setAlertsResponse] = useState<AlertsResponse | null>(null);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlertsResponse(data);
      setLoadError(null);
    } catch (error) {
      setLoadError(String(error));
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAcknowledge = async (alertId: number) => {
    setAcknowledging(alertId);
    try {
      await acknowledgeAlert(alertId);
      await loadAlerts();
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
    } finally {
      setAcknowledging(null);
    }
  };

  const activeCount = alertsResponse?.activeCount ?? 0;
  const actionCount = alertsResponse?.alerts.filter(a => a.severity === "ACTION" && a.status === "ACTIVE").length ?? 0;
  const warningCount = alertsResponse?.alerts.filter(a => a.severity === "WARNING" && a.status === "ACTIVE").length ?? 0;

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-800 sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-slate-200">Alerts</h1>
          {activeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-semibold">
              {activeCount}
            </span>
          )}
        </div>
        {alertsResponse && (
          <div className="flex items-center gap-4 text-xs text-slate-500">
            {actionCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {actionCount} Action
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {warningCount} Warning
              </span>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 p-6 space-y-3 overflow-auto">
        {loadError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm">
            Failed to load alerts: {loadError}
          </div>
        )}

        {alertsResponse?.alerts.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-16">
            No alerts yet. Alerts fire after signal computation runs.
          </div>
        )}

        {alertsResponse?.alerts.map((alert: AlertDto) => (
          <div
            key={alert.id}
            className={`border rounded-md px-4 py-3 ${SEVERITY_STYLES[alert.severity] ?? "border-slate-700 text-slate-400"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wide">{alert.severity}</span>
                  <span className="text-xs text-slate-600">·</span>
                  <span className="text-xs text-slate-500">{RULE_LABELS[alert.ruleId] ?? alert.ruleId}</span>
                  {alert.categoryId && (
                    <>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs font-mono text-slate-400">{alert.categoryId}</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-slate-300">{alert.message}</p>
                <p className="text-xs text-slate-600 mt-1">{formatAlertTime(alert.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {alert.status === "ACTIVE" && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging === alert.id}
                    className="text-xs px-2 py-1 border border-slate-600 text-slate-400 rounded hover:text-slate-200 hover:border-slate-500 transition-colors disabled:opacity-50"
                  >
                    {acknowledging === alert.id ? "…" : "Acknowledge"}
                  </button>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLES[alert.status] ?? ""}`}>
                  {alert.status}
                </span>
              </div>
            </div>
          </div>
        ))}

        {!alertsResponse && !loadError && (
          <div className="text-slate-500 text-sm text-center py-16">
            Loading alerts…
          </div>
        )}
      </main>
    </div>
  );
}

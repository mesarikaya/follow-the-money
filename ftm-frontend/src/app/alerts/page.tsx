"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchAlerts, acknowledgeAlert, AlertsResponse, AlertDto } from "@/lib/api";

const SEVERITY_STYLES: Record<string, { badge: string; row: string }> = {
  ACTION:  { badge: "bg-red-900/80 text-red-300 border border-red-700/50",    row: "bg-red-950/20"    },
  WARNING: { badge: "bg-amber-900/80 text-amber-300 border border-amber-700/50", row: "bg-amber-950/15" },
  INFO:    { badge: "bg-blue-900/80 text-blue-300 border border-blue-700/50",  row: "bg-blue-950/10"   },
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:       "text-amber-400",
  ACKNOWLEDGED: "text-slate-400",
  RESOLVED:     "text-emerald-400",
};

const RULE_LABELS: Record<string, string> = {
  rrg_transition:     "RRG Transition",
  composite_breakout: "Composite Breakout",
  macro_regime_shift: "Macro Regime Shift",
  rs_accel_crossover: "RS Accel Crossover",
  flow_inflow_5d:     "Flow Inflow (5d)",
  flow_inflow_10d:    "Flow Inflow (10d)",
  flow_inflow_20d:    "Flow Inflow (20d)",
  flow_outflow_5d:    "Flow Outflow (5d)",
  flow_outflow_10d:   "Flow Outflow (10d)",
  flow_outflow_20d:   "Flow Outflow (20d)",
};

const BUILTIN_RULES = [
  { id: "rrg_transition",     label: "RRG Transition",      condition: "RRG quadrant changes",      severity: "INFO",    note: "Any category enters Leading or Improving quadrant" },
  { id: "composite_breakout", label: "Composite Breakout",  condition: "composite_score > 0.80",    severity: "ACTION",  note: "Category score crosses into strong signal territory" },
  { id: "macro_regime_shift", label: "Macro Regime Shift",  condition: "regime changes",            severity: "WARNING", note: "Macro regime classification changes on new data" },
  { id: "rs_accel_crossover", label: "RS Accel Crossover",  condition: "rs_60 crosses rs_120",      severity: "INFO",    note: "Near-term RS crosses long-term RS baseline — momentum acceleration or deceleration shift" },
  { id: "flow_inflow_20d",    label: "Flow Inflow (20d)",   condition: "flow_20d > threshold",      severity: "INFO",    note: "Sustained 20-day inflow above baseline" },
  { id: "flow_outflow_20d",   label: "Flow Outflow (20d)",  condition: "flow_20d < threshold",      severity: "WARNING", note: "Sustained 20-day outflow below baseline" },
];

function formatAlertDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return isoString; }
}

function formatDateShort(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return isoString; }
}

export default function AlertsPage() {
  const [alertsResponse, setAlertsResponse] = useState<AlertsResponse | null>(null);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [acknowledgeError, setAcknowledgeError] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlertsResponse(data);
      setLoadError(null);
    } catch (error) {
      setLoadError(String(error));
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  const handleAcknowledge = async (alertId: number) => {
    setAcknowledging(alertId);
    setAcknowledgeError(null);
    try {
      await acknowledgeAlert(alertId);
      await loadAlerts();
    } catch (error) {
      setAcknowledgeError(String(error));
    } finally {
      setAcknowledging(null);
    }
  };

  const allAlerts = alertsResponse?.alerts ?? [];
  const activeAlerts  = allAlerts.filter(a => a.status === "ACTIVE").sort((a, b) => {
    const order = { ACTION: 0, WARNING: 1, INFO: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  const historyAlerts = allAlerts.filter(a => a.status !== "ACTIVE")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);

  const activeCount  = alertsResponse?.activeCount ?? 0;
  const actionCount  = activeAlerts.filter(a => a.severity === "ACTION").length;
  const warningCount = activeAlerts.filter(a => a.severity === "WARNING").length;

  const severityBadgeCls = (sev: string) => SEVERITY_STYLES[sev]?.badge ?? "bg-slate-700 text-slate-300 border border-slate-600";
  const rowBgCls         = (sev: string) => SEVERITY_STYLES[sev]?.row ?? "";

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <h1
            className="text-slate-100 font-bold"
            style={{ fontFamily: "var(--font-rajdhani)", fontSize: "22px", letterSpacing: "0.02em" }}
          >
            Alerts
          </h1>
          {activeCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-semibold">{activeCount}</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {actionCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> {actionCount} Action</span>}
          {warningCount > 0 && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> {warningCount} Warning</span>}
          {alertsResponse && <span className="text-slate-600">· {BUILTIN_RULES.length} rules defined</span>}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {(acknowledgeError || loadError) && (
          <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm flex items-center justify-between">
            <span>{acknowledgeError ? `Failed to acknowledge: ${acknowledgeError}` : `Failed to load alerts: ${loadError}`}</span>
            <button onClick={() => { setAcknowledgeError(null); setLoadError(null); }} className="ml-4 text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">

          {/* Left 2/3: Alerts + History + Rules */}
          <div className="col-span-2 flex flex-col gap-5">

            {/* Active Alerts */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                <span className="text-sm font-semibold text-slate-200">Active Alerts</span>
                <span className="text-[10px] text-slate-500 ml-1" title="Alerts fire after each ingestion. Acknowledge to suppress until next trigger.">(?)
</span>
              </div>

              {!alertsResponse && !loadError && (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</div>
              )}
              {alertsResponse && activeAlerts.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500 text-sm">
                  No active alerts. Alerts fire after signal computation runs.
                </div>
              )}
              {activeAlerts.map((alert: AlertDto) => (
                <div key={alert.id} className={`px-4 py-3 border-b border-slate-700 last:border-0 flex items-start gap-3 ${rowBgCls(alert.severity)}`}>
                  <div className="mt-0.5 shrink-0">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeCls(alert.severity)}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {alert.categoryId && (
                        <span className="font-mono text-sm font-semibold text-slate-200">{alert.categoryId}</span>
                      )}
                      <span className="text-xs text-slate-500">{RULE_LABELS[alert.ruleId] ?? alert.ruleId}</span>
                      <span className="text-xs text-slate-600 ml-auto">{formatAlertDate(alert.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-300">{alert.message}</p>
                  </div>
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={acknowledging === alert.id}
                    className="shrink-0 text-xs text-slate-500 hover:text-slate-300 border border-slate-600 hover:border-slate-500 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {acknowledging === alert.id ? "…" : "Dismiss"}
                  </button>
                </div>
              ))}
            </div>

            {/* Alert History */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">Alert History</span>
                <span className="text-xs text-slate-500">— acknowledged &amp; resolved</span>
              </div>
              {historyAlerts.length === 0 ? (
                <div className="px-4 py-6 text-center text-slate-600 text-sm">No history yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5">Date</th>
                      <th className="text-left px-4 py-2.5">Category</th>
                      <th className="text-left px-4 py-2.5">Severity</th>
                      <th className="text-left px-4 py-2.5">Rule</th>
                      <th className="text-left px-4 py-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {historyAlerts.map((alert: AlertDto) => (
                      <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2 text-xs text-slate-500">{formatDateShort(alert.createdAt)}</td>
                        <td className="px-4 py-2 font-mono text-blue-300 font-medium text-xs">{alert.categoryId ?? "—"}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeCls(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-400">{RULE_LABELS[alert.ruleId] ?? alert.ruleId}</td>
                        <td className={`px-4 py-2 text-xs ${STATUS_STYLES[alert.status] ?? "text-slate-500"}`}>{alert.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Alert Rules Reference */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200">Alert Rules</span>
                <span className="text-[10px] text-slate-500 ml-1" title="Rules are evaluated each time data is ingested. A rule fires when its condition transitions from false to true.">(?)
</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">Rule</th>
                    <th className="text-left px-4 py-2.5">Condition</th>
                    <th className="text-left px-4 py-2.5">Severity</th>
                    <th className="text-left px-4 py-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {BUILTIN_RULES.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-200 text-sm">{rule.label}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-slate-900 px-2 py-0.5 rounded font-mono text-slate-300">{rule.condition}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeCls(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{rule.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right 1/3: Info panel */}
          <div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sticky top-0">
              <div className="text-sm font-semibold text-slate-200 mb-4">About Alerts</div>
              <div className="space-y-4 text-xs text-slate-400">
                <div>
                  <p className="font-medium text-slate-300 mb-1">How alerts fire</p>
                  <p>Rules are evaluated after each data ingestion. An alert fires when a condition transitions from false to true — not on every ingestion while the condition holds.</p>
                </div>
                <div>
                  <p className="font-medium text-slate-300 mb-1">Severity levels</p>
                  <div className="space-y-1.5 mt-2">
                    {(["ACTION", "WARNING", "INFO"] as const).map((sev) => (
                      <div key={sev} className="flex items-center gap-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${severityBadgeCls(sev)}`}>{sev}</span>
                        <span>{sev === "ACTION" ? "Strong signal — consider acting" : sev === "WARNING" ? "Potential concern — monitor closely" : "Informational — rotation event detected"}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="font-medium text-slate-300 mb-1">Dismiss vs. Resolve</p>
                  <p>Dismissing an alert acknowledges it and suppresses re-display. It auto-resolves on the next ingestion if the condition no longer holds.</p>
                </div>
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-slate-600 text-[10px]">Rule management (custom thresholds, per-category rules) is configured in the backend. Refresh the page after triggering ingestion to see new alerts.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

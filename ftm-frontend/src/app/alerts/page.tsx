"use client";

import {
  activeAlerts,
  alertHistory,
  countBySeverity,
  priorityAlerts,
} from "@/lib/alerts/alertFormatting";
import { useAlerts } from "@/app/alerts/useAlerts";
import AlertRuleActivityPanel from "@/components/AlertRuleActivityPanel";
import AlertSeverityTimeline from "@/components/AlertSeverityTimeline";
import {
  AboutAlertsPanel,
  ActiveAlertsPanel,
  AlertHistoryTable,
  AlertRulesPanel,
  SectorAlertGrid,
} from "@/components/alerts/panels";

export default function AlertsPage() {
  const {
    alertsResponse,
    alertRules,
    acknowledgingId,
    isBulkDismissing,
    togglingRuleId,
    loadError,
    acknowledgeError,
    countdown,
    refresh,
    toggleRule,
    dismissAll,
    acknowledge,
    clearErrors,
  } = useAlerts();

  const allAlerts = alertsResponse?.alerts ?? [];
  const active = activeAlerts(allAlerts);
  const history = alertHistory(allAlerts);
  // Counts what needs action, matching the feed's default view and the nav badge. The full
  // active total is still visible in the severity breakdown beside it.
  const needsActionCount = priorityAlerts(active).length;
  const errorMessage = acknowledgeError
    ? `Failed to acknowledge: ${acknowledgeError}`
    : loadError
    ? `Failed to load alerts: ${loadError}`
    : null;

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
          {needsActionCount > 0 && (
            <span className="text-xs px-1.5 py-0.5 bg-red-500 text-white rounded-full font-semibold">
              {needsActionCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          {countBySeverity(active, "URGENT") > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-300 inline-block animate-pulse" />{" "}
              {countBySeverity(active, "URGENT")} Urgent
            </span>
          )}
          {countBySeverity(active, "ACTION") > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{" "}
              {countBySeverity(active, "ACTION")} Action
            </span>
          )}
          {countBySeverity(active, "WARNING") > 0 && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{" "}
              {countBySeverity(active, "WARNING")} Warning
            </span>
          )}
          {alertRules && <span className="text-slate-600">· {alertRules.length} rules loaded</span>}
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-1 rounded transition-colors"
            title="Refresh alerts now"
          >
            <span className="text-[11px]">⟳</span>
            <span className="tabular-nums text-[10px]">{countdown}s</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-6">
        {errorMessage && (
          <div className="mb-4 bg-red-900/40 border border-red-700 text-red-300 px-4 py-3 rounded-md text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button onClick={clearErrors} className="ml-4 text-red-400 hover:text-red-200">
              ✕
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 flex flex-col gap-5">
            <ActiveAlertsPanel
              alerts={active}
              isLoaded={alertsResponse != null}
              hasLoadError={loadError != null}
              acknowledgingId={acknowledgingId}
              isBulkDismissing={isBulkDismissing}
              onAcknowledge={acknowledge}
              onDismissAll={dismissAll}
            />
            <AlertHistoryTable alerts={history} />
            <AlertRulesPanel rules={alertRules} togglingRuleId={togglingRuleId} onToggle={toggleRule} />
          </div>

          <div className="flex flex-col gap-5">
            <SectorAlertGrid alerts={active} />
            <AlertSeverityTimeline />
            <AlertRuleActivityPanel />
            <AboutAlertsPanel />
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertDto, AlertRuleDto } from "@/lib/api";
import {
  AlertGroup,
  EQUITY_SECTORS,
  alertAgeBadge,
  formatAlertDate,
  formatDateShort,
  groupAlertsByEvent,
  marketWideCount,
  parseSnapshot,
  priorityAlerts,
  worstSeverityBySector,
} from "@/lib/alerts/alertFormatting";
import {
  BUILTIN_RULES,
  RULE_LABELS,
  STATUS_STYLES,
  severityBadgeClass,
  severityRowClass,
} from "@/components/alerts/alertConfig";

/** The panels of the alerts page: the live feed, the history, the rules, and the sector grid. */

const SnapshotViewer = ({ raw }: { raw: string | null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const snapshot = parseSnapshot(raw);
  if (!snapshot) return null;
  return (
    <div className="mt-1.5">
      <button
        onClick={() => setIsOpen(open => !open)}
        className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
      >
        {isOpen ? "▲ hide details" : "▼ signal snapshot"}
      </button>
      {isOpen && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(snapshot).map(([key, value]) => (
            <span key={key} className="text-[10px] font-mono">
              <span className="text-slate-600">{key}:</span>{" "}
              <span className="text-slate-300">{String(value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const AlertSubject = ({ alert }: { alert: AlertDto }) => (
  <>
    {alert.categoryId && (
      <span className="font-mono text-sm font-semibold text-slate-200">{alert.categoryId}</span>
    )}
    {alert.themeId && (
      <Link
        href={`/themes/${alert.themeId}`}
        className="font-mono text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded hover:bg-cyan-500/20 transition-colors"
        title={`View theme: ${alert.themeId}`}
      >
        {alert.themeId.replace(/_/g, " ")}
      </Link>
    )}
  </>
);

const AgeBadge = ({ createdAt }: { createdAt: string }) => {
  const age = alertAgeBadge(createdAt);
  if (!age) return null;
  return (
    <span
      className={`text-[9px] font-mono px-1 py-0.5 rounded ${age.cls}`}
      title={`Alert has been active for ${age.label}`}
    >
      {age.label}
    </span>
  );
};

const AlertRow = ({
  alert,
  acknowledgingId,
  onAcknowledge,
  isNested = false,
}: {
  alert: AlertDto;
  acknowledgingId: number | null;
  onAcknowledge: (alertId: number) => void;
  isNested?: boolean;
}) => (
  <div
    className={`px-4 py-3 border-b border-slate-700 last:border-0 flex items-start gap-3 ${severityRowClass(alert.severity)} ${isNested ? "pl-10" : ""}`}
  >
    {!isNested && (
      <div className="mt-0.5 shrink-0">
        <span
          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeClass(alert.severity)}`}
        >
          {alert.severity}
        </span>
      </div>
    )}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <AlertSubject alert={alert} />
        {!isNested && (
          <span className="text-xs text-slate-500">{RULE_LABELS[alert.ruleId] ?? alert.ruleId}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <AgeBadge createdAt={alert.createdAt} />
          <span className="text-xs text-slate-600">{formatAlertDate(alert.createdAt)}</span>
        </div>
      </div>
      <p className="text-sm text-slate-300">{alert.message}</p>
      <SnapshotViewer raw={alert.triggerSnapshot} />
    </div>
    <button
      onClick={() => onAcknowledge(alert.id)}
      disabled={acknowledgingId === alert.id}
      className="shrink-0 text-xs text-slate-500 hover:text-slate-300 border border-slate-600 hover:border-slate-500 px-2 py-1 rounded transition-colors disabled:opacity-50"
    >
      {acknowledgingId === alert.id ? "…" : "Dismiss"}
    </button>
  </div>
);

/**
 * One market event that fanned out across many themes or sectors. Collapsed by default — the whole
 * point is that nine rows saying the same thing is one thing worth reading, not nine.
 */
const AlertEventGroup = ({
  group,
  acknowledgingId,
  onAcknowledge,
}: {
  group: AlertGroup;
  acknowledgingId: number | null;
  onAcknowledge: (alertId: number) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="border-b border-slate-700 last:border-0">
      <button
        onClick={() => setIsExpanded(expanded => !expanded)}
        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-700/20 transition-colors ${severityRowClass(group.severity)}`}
      >
        <div className="mt-0.5 shrink-0">
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeClass(group.severity)}`}
          >
            {group.severity}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-slate-200">
              {RULE_LABELS[group.ruleId] ?? group.ruleId}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 border border-slate-600">
              ×{group.alerts.length}
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <AgeBadge createdAt={group.alerts[0].createdAt} />
              <span className="text-xs text-slate-600">
                {formatAlertDate(group.alerts[0].createdAt)}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 truncate">
            {group.subjects.map(subject => subject.replace(/_/g, " ")).join(", ")}
          </p>
        </div>
        <span className="shrink-0 text-xs text-slate-500 mt-0.5">{isExpanded ? "▲" : "▼"}</span>
      </button>
      {isExpanded &&
        group.alerts.map(alert => (
          <AlertRow
            key={alert.id}
            alert={alert}
            acknowledgingId={acknowledgingId}
            onAcknowledge={onAcknowledge}
            isNested
          />
        ))}
    </div>
  );
};

export const ActiveAlertsPanel = ({
  alerts,
  isLoaded,
  hasLoadError,
  acknowledgingId,
  isBulkDismissing,
  onAcknowledge,
  onDismissAll,
}: {
  alerts: AlertDto[];
  isLoaded: boolean;
  hasLoadError: boolean;
  acknowledgingId: number | null;
  isBulkDismissing: boolean;
  onAcknowledge: (alertId: number) => void;
  onDismissAll: () => void;
}) => {
  const [isShowingAll, setIsShowingAll] = useState(false);
  const visibleAlerts = isShowingAll ? alerts : priorityAlerts(alerts);
  const hiddenCount = alerts.length - visibleAlerts.length;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2 flex-wrap">
        <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
        <span className="text-sm font-semibold text-slate-200">
          {isShowingAll ? "All Alerts" : "Needs Action"}
        </span>
        <span
          className="text-[10px] text-slate-500 ml-1"
          title="Opens with what needs action. Lower-priority alerts are still here, one click away. Alerts fire after each ingestion; acknowledge to suppress until next trigger."
        >
          (?)
        </span>
        {hiddenCount > 0 && !isShowingAll && (
          <button
            onClick={() => setIsShowingAll(true)}
            className="text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-0.5 rounded transition-colors"
          >
            + {hiddenCount} lower priority
          </button>
        )}
        {isShowingAll && (
          <button
            onClick={() => setIsShowingAll(false)}
            className="text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-0.5 rounded transition-colors"
          >
            Needs action only
          </button>
        )}
        {alerts.length > 1 && (
          <button
            onClick={onDismissAll}
            disabled={isBulkDismissing}
            className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 border border-slate-700 hover:border-slate-500 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
          >
            {isBulkDismissing ? "Dismissing…" : `Dismiss all ${alerts.length}`}
          </button>
        )}
      </div>

      {!isLoaded && !hasLoadError && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">Loading…</div>
      )}
      {isLoaded && alerts.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">
          No active alerts. Alerts fire after signal computation runs.
        </div>
      )}
      {isLoaded && alerts.length > 0 && visibleAlerts.length === 0 && (
        <div className="px-4 py-8 text-center text-slate-500 text-sm">
          Nothing needs action. {hiddenCount} lower-priority alert
          {hiddenCount === 1 ? "" : "s"} — expand above to review.
        </div>
      )}

      {groupAlertsByEvent(visibleAlerts).map(group =>
        group.alerts.length === 1 ? (
          <AlertRow
            key={group.key}
            alert={group.alerts[0]}
            acknowledgingId={acknowledgingId}
            onAcknowledge={onAcknowledge}
          />
        ) : (
          <AlertEventGroup
            key={group.key}
            group={group}
            acknowledgingId={acknowledgingId}
            onAcknowledge={onAcknowledge}
          />
        ),
      )}
    </div>
  );
};

export const AlertHistoryTable = ({ alerts }: { alerts: AlertDto[] }) => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-200">Alert History</span>
      <span className="text-xs text-slate-500">— acknowledged &amp; resolved</span>
    </div>
    {alerts.length === 0 ? (
      <div className="px-4 py-6 text-center text-slate-600 text-sm">No history yet.</div>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-2.5">Date</th>
            <th className="text-left px-4 py-2.5">Category</th>
            <th className="text-left px-4 py-2.5">Severity</th>
            <th className="text-left px-4 py-2.5">Rule</th>
            <th className="text-left px-4 py-2.5">Message</th>
            <th className="text-left px-4 py-2.5">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {alerts.map(alert => (
            <tr key={alert.id} className="hover:bg-slate-800/40 transition-colors" title={alert.message}>
              <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">
                {formatDateShort(alert.createdAt)}
              </td>
              <td className="px-4 py-2 font-mono text-blue-300 font-medium text-xs">
                {alert.themeId ? (
                  <Link href={`/themes/${alert.themeId}`} className="text-cyan-400 hover:underline">
                    {alert.themeId.replace(/_/g, " ")}
                  </Link>
                ) : (
                  alert.categoryId ?? "—"
                )}
              </td>
              <td className="px-4 py-2">
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeClass(alert.severity)}`}
                >
                  {alert.severity}
                </span>
              </td>
              <td className="px-4 py-2 text-xs text-slate-400 whitespace-nowrap">
                {RULE_LABELS[alert.ruleId] ?? alert.ruleId}
              </td>
              <td className="px-4 py-2 text-xs text-slate-500 max-w-[280px] truncate">{alert.message}</td>
              <td className={`px-4 py-2 text-xs whitespace-nowrap ${STATUS_STYLES[alert.status] ?? "text-slate-500"}`}>
                {alert.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

const RuleThresholds = ({ rule }: { rule: AlertRuleDto }) => {
  const hasThresholds = rule.compositeThreshold != null || rule.persistenceDays != null;
  return (
    <div className="flex flex-col gap-0.5">
      {rule.compositeThreshold != null && (
        <span className="text-[10px] font-mono text-slate-500">
          score <span className="text-slate-400">{rule.compositeThreshold.toFixed(2)}</span>
        </span>
      )}
      {rule.persistenceDays != null && (
        <span className="text-[10px] font-mono text-slate-500">
          persist &lt; <span className="text-slate-400">{rule.persistenceDays}d</span>
        </span>
      )}
      {!hasThresholds && <span className="text-[10px] text-slate-700">—</span>}
    </div>
  );
};

export const AlertRulesPanel = ({
  rules,
  togglingRuleId,
  onToggle,
}: {
  rules: AlertRuleDto[] | null;
  togglingRuleId: string | null;
  onToggle: (ruleId: string, isEnabled: boolean) => void;
}) => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-700 flex items-center gap-2">
      <span className="text-sm font-semibold text-slate-200">Alert Rules</span>
      <span
        className="text-[10px] text-slate-500 ml-1"
        title="Rules are evaluated after each ingestion. Toggle to enable or disable a rule."
      >
        (live · toggleable)
      </span>
    </div>
    {rules == null ? (
      <div className="px-4 py-6 text-center text-slate-600 text-sm">Loading rules…</div>
    ) : rules.length === 0 ? (
      <div className="px-4 py-6 text-center text-slate-600 text-sm">No alert rules configured.</div>
    ) : (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-800/80 text-slate-400 text-xs uppercase tracking-wider">
            <th className="text-left px-4 py-2.5">Rule</th>
            <th className="text-left px-4 py-2.5">Severity</th>
            <th className="text-left px-4 py-2.5">Thresholds</th>
            <th className="text-right px-4 py-2.5">Enabled</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {rules.map(rule => {
            const description = BUILTIN_RULES.find(builtin => builtin.id === rule.ruleId);
            return (
              <tr
                key={rule.ruleId}
                className={`hover:bg-slate-800/40 transition-colors ${!rule.enabled ? "opacity-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-200 text-sm">{description?.label ?? rule.ruleId}</div>
                  {description?.note && (
                    <div className="text-[10px] text-slate-600 mt-0.5">{description.note}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityBadgeClass(rule.severity)}`}
                  >
                    {rule.severity}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RuleThresholds rule={rule} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onToggle(rule.ruleId, rule.enabled)}
                    disabled={togglingRuleId === rule.ruleId}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${rule.enabled ? "bg-blue-600" : "bg-slate-600"}`}
                    title={rule.enabled ? "Click to disable" : "Click to enable"}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${rule.enabled ? "translate-x-4" : "translate-x-1"}`}
                    />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    )}
  </div>
);

const SECTOR_DOT_CLASS: Record<string, string> = {
  URGENT: "bg-red-500 shadow-[0_0_5px_1px_rgba(239,68,68,0.5)]",
  ACTION: "bg-red-700",
  WARNING: "bg-amber-500",
  INFO: "bg-blue-500",
};

export const SectorAlertGrid = ({ alerts }: { alerts: AlertDto[] }) => {
  const worstBySector = worstSeverityBySector(alerts);
  const marketWide = marketWideCount(alerts);
  const isAllClear = Object.keys(worstBySector).length === 0 && marketWide === 0;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-300 mb-3">Sector Alert Status</div>
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {EQUITY_SECTORS.map(sector => {
          const severity = worstBySector[sector];
          return (
            <div
              key={sector}
              className="flex flex-col items-center gap-1 py-1.5 px-1 rounded bg-slate-900/40 border border-slate-700/40"
              title={severity ? `${sector}: ${severity} active alert` : `${sector}: no active alerts`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${severity ? SECTOR_DOT_CLASS[severity] : "bg-slate-700"}`}
              />
              <span className={`text-[9px] font-mono ${severity ? "text-slate-200" : "text-slate-600"}`}>
                {sector}
              </span>
            </div>
          );
        })}
      </div>
      {marketWide > 0 && (
        <div className="text-[10px] text-amber-400/70 border-t border-slate-700/40 pt-2">
          +{marketWide} market-wide alert{marketWide > 1 ? "s" : ""} (no specific sector)
        </div>
      )}
      {isAllClear && <p className="text-[10px] text-slate-600">All clear — no active sector alerts</p>}
    </div>
  );
};

const SEVERITY_MEANINGS: Record<string, string> = {
  URGENT: "Immediate attention — critical regime or risk event",
  ACTION: "Strong signal — consider acting",
  WARNING: "Potential concern — monitor closely",
  INFO: "Informational — rotation event detected",
};

export const AboutAlertsPanel = () => (
  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sticky top-0">
    <div className="text-sm font-semibold text-slate-200 mb-4">About Alerts</div>
    <div className="space-y-4 text-xs text-slate-400">
      <div>
        <p className="font-medium text-slate-300 mb-1">How alerts fire</p>
        <p>
          Rules are evaluated after each data ingestion. An alert fires when a condition transitions
          from false to true — not on every ingestion while the condition holds.
        </p>
      </div>
      <div>
        <p className="font-medium text-slate-300 mb-1">Severity levels</p>
        <div className="space-y-1.5 mt-2">
          {Object.entries(SEVERITY_MEANINGS).map(([severity, meaning]) => (
            <div key={severity} className="flex items-center gap-2">
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${severityBadgeClass(severity)}`}
              >
                {severity}
              </span>
              <span>{meaning}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="font-medium text-slate-300 mb-1">Dismiss vs. Resolve</p>
        <p>
          Dismissing an alert acknowledges it and suppresses re-display. It auto-resolves on the next
          ingestion if the condition no longer holds.
        </p>
      </div>
      <div className="pt-3 border-t border-slate-700">
        <p className="text-slate-600 text-[10px]">
          Rule management (custom thresholds, per-category rules) is configured in the backend.
          Refresh the page after triggering ingestion to see new alerts.
        </p>
      </div>
    </div>
  </div>
);

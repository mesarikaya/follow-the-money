import { BACKEND, get } from "./http";

/** The alert feed, its history, and the rules that produce it. */

export type AlertDto = {
  id: number;
  createdAt: string;
  categoryId: string | null;
  themeId: string | null;
  ruleId: string;
  severity: "INFO" | "WARNING" | "ACTION" | "URGENT";
  message: string;
  triggerSnapshot: string | null;
  status: "ACTIVE" | "RESOLVED" | "ACKNOWLEDGED";
  resolvedAt: string | null;
  acknowledgedAt: string | null;
};

export type AlertsResponse = {
  activeCount: number;
  alerts: AlertDto[];
};

export type AlertRuleDto = {
  ruleId: string;
  enabled: boolean;
  severity: "INFO" | "WARNING" | "ACTION" | "URGENT";
  compositeThreshold: number | null;
  persistenceDays: number | null;
};

export type AlertSeverityDayDto = {
  date: string;
  urgentCount: number;
  actionCount: number;
  warningCount: number;
  infoCount: number;
};

export const fetchAlerts = () => get<AlertsResponse>("/api/v1/alerts");

export const fetchThemeAlertHistory = (themeId: string) =>
  get<AlertDto[]>(`/api/v1/alerts/theme/${themeId}`);

export const fetchRecentAlerts = () => get<AlertDto[]>("/api/v1/alerts/recent");

export const fetchAlertRuleStats = (days = 30) =>
  get<Record<string, number>>(`/api/v1/alerts/rule-stats?days=${days}`);

export const fetchAlertRules = () => get<AlertRuleDto[]>("/api/v1/alerts/rules");

export const fetchAlertSeverityHistory = (days = 30) =>
  get<AlertSeverityDayDto[]>(`/api/v1/alerts/severity-history?days=${days}`);

/** `active` is every active alert; `needsAction` counts only the ACTION-grade ones the badges show. */
export const fetchActiveAlertCount = () =>
  get<{ active: number; needsAction?: number }>("/api/v1/alerts/active/count");

export const setAlertRuleEnabled = (ruleId: string, enabled: boolean) =>
  fetch(`${BACKEND}/api/v1/alerts/rules/${encodeURIComponent(ruleId)}/enabled?enabled=${enabled}`, {
    method: "PUT",
  }).then(async res => {
    if (!res.ok) throw new Error(`PUT /api/v1/alerts/rules/${ruleId}/enabled → ${res.status}`);
    return res.json() as Promise<AlertRuleDto>;
  });

export const acknowledgeAlert = (alertId: number) =>
  fetch(`${BACKEND}/api/v1/alerts/${alertId}/acknowledge`, {
    method: "POST",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`POST /api/v1/alerts/${alertId}/acknowledge → ${res.status}`);
    return res.json() as Promise<AlertDto>;
  });

export const bulkDismissAlerts = () =>
  fetch(`${BACKEND}/api/v1/alerts/bulk-dismiss`, {
    method: "POST",
    cache: "no-store",
  }).then(async (res) => {
    if (!res.ok) throw new Error(`POST /api/v1/alerts/bulk-dismiss → ${res.status}`);
    return res.json() as Promise<{ dismissed: number }>;
  });

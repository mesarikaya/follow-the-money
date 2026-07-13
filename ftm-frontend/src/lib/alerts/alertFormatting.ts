import { AlertDto } from "@/lib/api";

/**
 * Pure helpers behind the alerts page: how alerts are ordered, how old they are, and how the sector
 * grid decides what colour each sector gets. No React.
 */

/** Most urgent first — an unknown severity sorts below all the known ones. */
const SEVERITY_RANK: Record<string, number> = { URGENT: 0, ACTION: 1, WARNING: 2, INFO: 3 };
const UNKNOWN_SEVERITY_RANK = 4;

const HISTORY_LIMIT = 20;

export const activeAlerts = (alerts: AlertDto[]): AlertDto[] =>
  alerts
    .filter(alert => alert.status === "ACTIVE")
    .sort(
      (a, b) =>
        (SEVERITY_RANK[a.severity] ?? UNKNOWN_SEVERITY_RANK) -
        (SEVERITY_RANK[b.severity] ?? UNKNOWN_SEVERITY_RANK),
    );

/** The most recently raised alerts that are no longer active. */
export const alertHistory = (alerts: AlertDto[]): AlertDto[] =>
  alerts
    .filter(alert => alert.status !== "ACTIVE")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, HISTORY_LIMIT);

export const countBySeverity = (alerts: AlertDto[], severity: string): number =>
  alerts.filter(alert => alert.severity === severity).length;

export const EQUITY_SECTORS = [
  "TECH", "FINL", "HLTH", "DISR", "INDU", "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM",
];

/** Higher wins — the sector grid shows the worst thing happening in each sector. */
const SEVERITY_SEVERITY: Record<string, number> = { URGENT: 4, ACTION: 3, WARNING: 2, INFO: 1 };

/** The worst severity currently active in each equity sector. Sectors with nothing are absent. */
export const worstSeverityBySector = (alerts: AlertDto[]): Record<string, string> => {
  const worst: Record<string, string> = {};
  for (const alert of alerts) {
    const sector = alert.categoryId;
    if (!sector || !EQUITY_SECTORS.includes(sector)) continue;
    const current = worst[sector];
    if (!current || (SEVERITY_SEVERITY[alert.severity] ?? 0) > (SEVERITY_SEVERITY[current] ?? 0)) {
      worst[sector] = alert.severity;
    }
  }
  return worst;
};

/** Alerts that belong to no single sector — a macro regime shift, say. */
export const marketWideCount = (alerts: AlertDto[]): number =>
  alerts.filter(alert => !alert.categoryId).length;

/** The raw trigger snapshot, parsed. Null when there is none or it is not JSON. */
export const parseSnapshot = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const formatAlertDate = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
};

export const formatDateShort = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return isoString;
  }
};

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * 24;
const STALE_DAYS = 7;

export type AgeBadge = { label: string; cls: string };

/**
 * How long an alert has been sitting there. A brand-new alert gets no badge — only an ageing one is
 * worth pointing at, and one older than a week is worth pointing at in amber.
 */
export const alertAgeBadge = (isoString: string): AgeBadge | null => {
  try {
    const ageMs = Date.now() - new Date(isoString).getTime();
    const ageDays = Math.floor(ageMs / MILLISECONDS_PER_DAY);
    const ageHours = Math.floor(ageMs / MILLISECONDS_PER_HOUR);

    if (ageDays >= STALE_DAYS) {
      return {
        label: `${ageDays}d`,
        cls: "text-amber-600/70 bg-amber-950/20 border border-amber-900/30",
      };
    }
    if (ageDays >= 1) {
      return { label: `${ageDays}d`, cls: "text-slate-600 bg-slate-700/30 border border-slate-700" };
    }
    if (ageHours >= 1) {
      return {
        label: `${ageHours}h`,
        cls: "text-slate-700 bg-slate-700/20 border border-slate-800",
      };
    }
    return null;
  } catch {
    return null;
  }
};

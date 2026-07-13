import { AlertDto } from "@/lib/api";
import {
  activeAlerts,
  alertAgeBadge,
  alertHistory,
  marketWideCount,
  parseSnapshot,
  worstSeverityBySector,
} from "./alertFormatting";

function alert(overrides: Partial<AlertDto>): AlertDto {
  return {
    id: 1,
    createdAt: "2026-07-01T10:00:00Z",
    categoryId: null,
    themeId: null,
    ruleId: "rule",
    severity: "INFO",
    message: "",
    triggerSnapshot: null,
    status: "ACTIVE",
    resolvedAt: null,
    acknowledgedAt: null,
    ...overrides,
  } as AlertDto;
}

describe("activeAlerts", () => {
  it("keeps only the active ones, most urgent first", () => {
    const sorted = activeAlerts([
      alert({ id: 1, severity: "INFO" }),
      alert({ id: 2, severity: "URGENT" }),
      alert({ id: 3, severity: "ACTION", status: "RESOLVED" }),
      alert({ id: 4, severity: "WARNING" }),
    ]);

    expect(sorted.map(a => a.id)).toEqual([2, 4, 1]);
  });
});

describe("alertHistory", () => {
  it("keeps only the inactive ones, newest first, capped at twenty", () => {
    const history = alertHistory([
      alert({ id: 1, status: "ACTIVE" }),
      alert({ id: 2, status: "RESOLVED", createdAt: "2026-07-01T00:00:00Z" }),
      alert({ id: 3, status: "ACKNOWLEDGED", createdAt: "2026-07-05T00:00:00Z" }),
    ]);

    expect(history.map(a => a.id)).toEqual([3, 2]);
  });

  it("shows at most twenty", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      alert({ id: i, status: "RESOLVED", createdAt: `2026-07-${String(i + 1).padStart(2, "0")}T00:00:00Z` }),
    );
    expect(alertHistory(many)).toHaveLength(20);
  });
});

describe("worstSeverityBySector", () => {
  it("reports the worst active severity per sector and ignores anything that is not one", () => {
    const worst = worstSeverityBySector([
      alert({ categoryId: "TECH", severity: "WARNING" }),
      alert({ categoryId: "TECH", severity: "URGENT" }),
      alert({ categoryId: "ENRG", severity: "INFO" }),
      alert({ categoryId: "GOLD", severity: "URGENT" }),
      alert({ categoryId: null, severity: "URGENT" }),
    ]);

    expect(worst).toEqual({ TECH: "URGENT", ENRG: "INFO" });
  });
});

describe("marketWideCount", () => {
  it("counts the alerts that belong to no sector", () => {
    expect(
      marketWideCount([alert({ categoryId: null }), alert({ categoryId: "TECH" }), alert({ categoryId: null })]),
    ).toBe(2);
  });
});

describe("parseSnapshot", () => {
  it("parses a JSON snapshot and shrugs at anything else", () => {
    expect(parseSnapshot('{"score":0.7}')).toEqual({ score: 0.7 });
    expect(parseSnapshot("not json")).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
  });
});

describe("alertAgeBadge", () => {
  const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  it("says nothing about a brand-new alert", () => {
    expect(alertAgeBadge(hoursAgo(0.5))).toBeNull();
  });

  it("counts hours, then days, and turns amber once an alert is a week old", () => {
    expect(alertAgeBadge(hoursAgo(3))!.label).toBe("3h");
    expect(alertAgeBadge(hoursAgo(48))!.label).toBe("2d");

    const stale = alertAgeBadge(hoursAgo(24 * 8))!;
    expect(stale.label).toBe("8d");
    expect(stale.cls).toContain("amber");
  });

  it("shrugs at an unparseable date", () => {
    expect(alertAgeBadge("not a date")).toBeNull();
  });
});

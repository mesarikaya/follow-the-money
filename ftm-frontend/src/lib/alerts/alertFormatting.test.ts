import { AlertDto } from "@/lib/api";
import {
  activeAlerts,
  alertAgeBadge,
  alertHistory,
  groupAlertsByEvent,
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

describe("groupAlertsByEvent", () => {
  const themeReduce = (id: number, themeId: string) =>
    alert({ id, themeId, ruleId: "theme_dominant_signal_transition", severity: "ACTION" });

  it("collapses one rule firing across many themes on the same day into a single group", () => {
    // The real case: 9 of 12 themes entered REDUCE at once — one risk-off event, not nine findings.
    const groups = groupAlertsByEvent([
      themeReduce(1, "AI_INFRA"),
      themeReduce(2, "CLEAN_POWER"),
      themeReduce(3, "DEFENSE_REARM"),
      themeReduce(4, "CHIP_COMPUTE"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].alerts).toHaveLength(4);
    expect(groups[0].subjects).toEqual([
      "AI_INFRA",
      "CLEAN_POWER",
      "DEFENSE_REARM",
      "CHIP_COMPUTE",
    ]);
  });

  it("leaves a pair alone — two rows beat a summary you have to expand", () => {
    const groups = groupAlertsByEvent([themeReduce(1, "AI_INFRA"), themeReduce(2, "CLEAN_POWER")]);

    expect(groups).toHaveLength(2);
    expect(groups.every(group => group.alerts.length === 1)).toBe(true);
  });

  it("keeps different rules, severities and days apart", () => {
    const groups = groupAlertsByEvent([
      themeReduce(1, "A"),
      themeReduce(2, "B"),
      themeReduce(3, "C"),
      alert({ id: 4, ruleId: "score_velocity", severity: "ACTION", categoryId: "TECH" }),
      alert({ id: 5, ruleId: "theme_dominant_signal_transition", severity: "INFO", themeId: "D" }),
      alert({
        id: 6,
        ruleId: "theme_dominant_signal_transition",
        severity: "ACTION",
        themeId: "E",
        createdAt: "2026-07-02T10:00:00Z",
      }),
    ]);

    // The 3 same-rule/severity/day alerts group; the other three stand alone.
    expect(groups.map(group => group.alerts.length)).toEqual([3, 1, 1, 1]);
  });

  it("preserves the severity ordering it was handed", () => {
    const groups = groupAlertsByEvent(
      activeAlerts([
        alert({ id: 1, severity: "INFO", ruleId: "a" }),
        alert({ id: 2, severity: "URGENT", ruleId: "b" }),
        alert({ id: 3, severity: "WARNING", ruleId: "c" }),
      ]),
    );

    expect(groups.map(group => group.severity)).toEqual(["URGENT", "WARNING", "INFO"]);
  });

  it("never loses an alert", () => {
    const input = [
      themeReduce(1, "A"),
      themeReduce(2, "B"),
      themeReduce(3, "C"),
      alert({ id: 4, ruleId: "other", severity: "WARNING" }),
    ];

    const grouped = groupAlertsByEvent(input).flatMap(group => group.alerts);

    expect(grouped.map(a => a.id).sort()).toEqual([1, 2, 3, 4]);
  });
});

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

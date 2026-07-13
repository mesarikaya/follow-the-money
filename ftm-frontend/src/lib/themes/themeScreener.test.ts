import { ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import {
  buildScreenerUrl,
  isVisible,
  priorScoreRanks,
  sortThemes,
} from "./themeScreener";

function theme(id: string, overrides: Partial<ThemeSummary> = {}): ThemeSummary {
  return {
    id,
    compositeScore: 0.5,
    rs60: 0,
    compositeTrend5d: null,
    compositeTrend20d: null,
    scorePercentile30d: null,
    confluenceScore: 50,
    persistenceScore: 50,
    investmentQualityScore: 50,
    ...overrides,
  } as ThemeSummary;
}

function history(scores: number[]): ThemeHistoryPoint[] {
  return scores.map(compositeScore => ({ compositeScore }) as ThemeHistoryPoint);
}

describe("isVisible", () => {
  it("shows everything in the full view and a subset in the narrower ones", () => {
    expect(isVisible("conf", "full")).toBe(true);
    expect(isVisible("conf", "standard")).toBe(true);
    expect(isVisible("conf", "essential")).toBe(false);
    expect(isVisible("score", "essential")).toBe(true);
  });
});

describe("buildScreenerUrl", () => {
  it("merges the overrides in and drops anything empty", () => {
    expect(buildScreenerUrl({ sort: "score", signal: "BUY" }, { sort: "rs60" })).toBe(
      "/themes?sort=rs60&signal=BUY",
    );
    expect(buildScreenerUrl({ sort: "score" }, { sort: "" })).toBe("/themes");
    expect(buildScreenerUrl({}, {})).toBe("/themes");
  });
});

describe("sortThemes", () => {
  const themes = [
    theme("A", { compositeScore: 0.4, rs60: 0.09, confluenceScore: 10 }),
    theme("B", { compositeScore: 0.9, rs60: 0.01, confluenceScore: 90 }),
    theme("C", { compositeScore: 0.6, rs60: null, confluenceScore: 50 }),
  ];
  const noHistory = {};
  const noAlerts = {};

  it("sorts by score by default, and for an unknown sort key", () => {
    expect(sortThemes(themes, "score", noHistory, noAlerts).map(t => t.id)).toEqual(["B", "C", "A"]);
    expect(sortThemes(themes, "nonsense", noHistory, noAlerts).map(t => t.id)).toEqual(["B", "C", "A"]);
  });

  it("sorts by relative strength, putting a theme with none last", () => {
    expect(sortThemes(themes, "rs60", noHistory, noAlerts).map(t => t.id)).toEqual(["A", "B", "C"]);
  });

  it("sorts by the five-day score move, and needs six sessions to have one", () => {
    const histories = {
      A: history([0.1, 0.1, 0.1, 0.1, 0.1, 0.9]), // +0.8
      B: history([0.5, 0.5, 0.5, 0.5, 0.5, 0.6]), // +0.1
      C: history([0.9, 0.9]), // too short — sorts last
    };
    expect(sortThemes(themes, "delta5d", histories, noAlerts).map(t => t.id)).toEqual(["A", "B", "C"]);
  });

  it("breaks an equal alert count by score", () => {
    const alerts = { A: 3, B: 3, C: 0 };
    expect(sortThemes(themes, "alerts", noHistory, alerts).map(t => t.id)).toEqual(["B", "A", "C"]);
  });

  it("treats a LOW percentile as the interesting one", () => {
    const byPercentile = [
      theme("HIGH", { scorePercentile30d: 0.9 }),
      theme("LOW", { scorePercentile30d: 0.1 }),
    ];
    expect(sortThemes(byPercentile, "percentile", noHistory, noAlerts).map(t => t.id)).toEqual([
      "LOW",
      "HIGH",
    ]);
  });

  it("does not mutate the themes it was given", () => {
    const input = [...themes];
    sortThemes(input, "rs60", noHistory, noAlerts);
    expect(input.map(t => t.id)).toEqual(["A", "B", "C"]);
  });
});

describe("ranks", () => {
  const themes = [
    theme("A", { compositeScore: 0.4 }),
    theme("B", { compositeScore: 0.9 }),
  ];

  it("ranks the scores from five sessions ago, skipping themes without that history", () => {
    const histories = {
      A: history([0.9, 0.5, 0.5, 0.5, 0.5, 0.4]), // five sessions ago: 0.9
      B: history([0.1, 0.5, 0.5, 0.5, 0.5, 0.9]), // five sessions ago: 0.1
      C: history([0.5]),
    };

    expect(priorScoreRanks([...themes, theme("C")], histories)).toEqual({ A: 1, B: 2 });
  });
});

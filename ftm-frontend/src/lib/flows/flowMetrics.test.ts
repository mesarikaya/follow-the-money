import { CategorySummary, SeasonalReturn } from "@/lib/api";
import {
  computeBreadthVelocity,
  formatRs,
  maxAbsFlowZScore,
  maxAbsRelativeStrengthPercent,
  rankByRelativeStrength,
  rankByRiskAdjustedStrength,
  returnToColor,
  rsWindowDays,
  scoreToColor,
  selectSeasonalWinds,
} from "./flowMetrics";

function category(overrides: Partial<CategorySummary>): CategorySummary {
  return {
    id: "TECH",
    name: "Technology",
    etfTicker: "XLK",
    rs60: null,
    rs120: null,
    flow20d: null,
    persistence20d: null,
    persistence5d: null,
    realizedVol20d: null,
    compositeScore: null,
    tradeSignal: null,
    ...overrides,
  } as CategorySummary;
}

function seasonal(categoryId: string, month: number, avgReturn: number): SeasonalReturn {
  return { categoryId, month, avgReturn, sampleCount: 5 } as SeasonalReturn;
}

describe("rsWindowDays", () => {
  it("maps the timeframe onto the relative-strength lookback", () => {
    expect(rsWindowDays("DAY")).toBe(20);
    expect(rsWindowDays("WEEK")).toBe(20);
    expect(rsWindowDays("QUARTER")).toBe(120);
    expect(rsWindowDays("YEAR")).toBe(120);
    expect(rsWindowDays("MONTH")).toBe(60);
    expect(rsWindowDays("anything else")).toBe(60);
  });
});

describe("formatRs", () => {
  it("signs the percentage and dashes out missing readings", () => {
    expect(formatRs(0.0512)).toBe("+5.1%");
    expect(formatRs(-0.0312)).toBe("-3.1%");
    expect(formatRs(0)).toBe("+0.0%");
    expect(formatRs(null)).toBe("—");
  });
});

describe("ranking and bar scales", () => {
  it("ranks by relative strength, dropping categories without a reading", () => {
    const ranked = rankByRelativeStrength([
      category({ id: "A", rs60: 0.01 }),
      category({ id: "B", rs60: null }),
      category({ id: "C", rs60: 0.05 }),
    ]);
    expect(ranked.map(c => c.id)).toEqual(["C", "A"]);
  });

  it("scales bars to the widest reading, falling back when nothing moved", () => {
    expect(maxAbsRelativeStrengthPercent([category({ rs60: -0.15 })])).toBeCloseTo(15);
    expect(maxAbsRelativeStrengthPercent([category({ rs60: 0 })])).toBe(10);
    expect(maxAbsRelativeStrengthPercent([])).toBe(10);

    expect(maxAbsFlowZScore([category({ flow20d: -3 })])).toBe(3);
    expect(maxAbsFlowZScore([category({ flow20d: 0 })])).toBe(2);
    expect(maxAbsFlowZScore([])).toBe(2);
  });
});

describe("rankByRiskAdjustedStrength", () => {
  it("divides relative strength by volatility, assuming 20% when it is unknown", () => {
    const ranked = rankByRiskAdjustedStrength([
      category({ id: "SAFE", rs60: 0.05, realizedVol20d: 0.10 }),
      category({ id: "WILD", rs60: 0.05, realizedVol20d: 0.40 }),
      category({ id: "UNKNOWN", rs60: 0.05 }),
      category({ id: "NO_RS", rs60: null }),
    ]);

    expect(ranked.map(c => c.id)).toEqual(["SAFE", "UNKNOWN", "WILD"]);
    expect(ranked[0].sharpeProxy).toBeCloseTo(0.5);
    expect(ranked[1].volatility).toBe(0.20);
    expect(ranked[1].isVolatilityKnown).toBe(false);
    expect(ranked[2].isVolatilityKnown).toBe(true);
  });
});

describe("computeBreadthVelocity", () => {
  it("compares the last 5 days of breadth with the 15 before them", () => {
    const accelerating = computeBreadthVelocity(5, 10);
    expect(accelerating!.changeInPercentagePoints).toBe(67);

    const decelerating = computeBreadthVelocity(0, 15);
    expect(decelerating!.changeInPercentagePoints).toBe(-100);
  });

  it("stays quiet when a reading is missing or the change is negligible", () => {
    expect(computeBreadthVelocity(null, 10)).toBeNull();
    expect(computeBreadthVelocity(5, null)).toBeNull();
    expect(computeBreadthVelocity(5, 20)).toBeNull();
  });
});

describe("selectSeasonalWinds", () => {
  const categories = [category({ id: "A" }), category({ id: "B" }), category({ id: "C" })];

  it("splits the month into tailwinds and headwinds, ignoring flat months", () => {
    const winds = selectSeasonalWinds(
      [
        seasonal("A", 3, 0.02),
        seasonal("B", 3, -0.03),
        seasonal("C", 3, 0.001),
        seasonal("A", 4, 0.09),
        seasonal("MISSING", 3, 0.05),
      ],
      categories,
      3,
    );

    expect(winds.tailwinds.map(e => e.category.id)).toEqual(["A"]);
    expect(winds.headwinds.map(e => e.category.id)).toEqual(["B"]);
  });

  it("caps each side of the list", () => {
    const many = Array.from({ length: 8 }, (_, i) => category({ id: `T${i}` }));
    const winds = selectSeasonalWinds(
      many.map((c, i) => seasonal(c.id, 1, 0.01 * (i + 1))),
      many,
      1,
    );
    expect(winds.tailwinds).toHaveLength(5);
    expect(winds.tailwinds[0].category.id).toBe("T7");
  });
});

describe("heatmap colours", () => {
  it("bands scores and scales returns against the map maximum", () => {
    expect(scoreToColor(null)).toBe("#1e293b");
    expect(scoreToColor(0.75)).toBe("#15803d");
    expect(scoreToColor(0.1)).toBe("#b91c1c");

    expect(returnToColor(0.05, 0)).toBe("#1e293b");
    expect(returnToColor(0.05, 0.05)).toBe("rgb(20,190,80)");
    expect(returnToColor(-0.05, 0.05)).toBe("rgb(210,20,20)");
  });
});

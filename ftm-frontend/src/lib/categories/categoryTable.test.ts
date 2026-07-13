import { CategorySummary, SignalWinRateDto } from "@/lib/api";
import { deriveTradeSignal } from "@/lib/signals";
import {
  buildCategoriesCsv,
  buildRsRankPercentiles,
  buildScoreTooltip,
  computeStreak,
  filterCategories,
  findScoreExtreme,
  rsLabelFor,
  sortCategories,
} from "./categoryTable";

function category(overrides: Partial<CategorySummary>): CategorySummary {
  return {
    id: "GOLD",
    name: "Gold",
    etfTicker: "GLD",
    type: "PRECIOUS_METAL",
    rank: 1,
    compositeScore: null,
    compositeTrend5d: null,
    compositeTrend20d: null,
    rrgQuadrant: null,
    tradeSignal: null,
    latestClose: null,
    macroFit: null,
    convictionScore: null,
    signalDaysActive: null,
    momentum: null,
    persistence5d: null,
    persistence20d: null,
    scorePercentile252d: null,
    rs20: null,
    rs60: null,
    rs120: null,
    ...overrides,
  } as CategorySummary;
}

const signalOf = (c: CategorySummary) => c.tradeSignal as never ?? deriveTradeSignal(c);

describe("rsLabelFor", () => {
  it("maps the timeframe onto the relative-strength window", () => {
    expect(rsLabelFor("DAY")).toBe("20d");
    expect(rsLabelFor("MONTH")).toBe("60d");
    expect(rsLabelFor("YEAR")).toBe("120d");
    expect(rsLabelFor("unknown")).toBe("60d");
  });
});

describe("filterCategories", () => {
  const categories = [
    category({ id: "TECH", name: "Technology", etfTicker: "XLK" }),
    category({ id: "ENRG", name: "Energy", etfTicker: "XLE" }),
  ];

  it("matches on name or ticker, case-insensitively", () => {
    expect(filterCategories(categories, "tech").map(c => c.id)).toEqual(["TECH"]);
    expect(filterCategories(categories, "XLE").map(c => c.id)).toEqual(["ENRG"]);
    expect(filterCategories(categories, "  ")).toHaveLength(2);
    expect(filterCategories(categories, "nothing")).toHaveLength(0);
  });
});

describe("sortCategories", () => {
  const categories = [
    category({ id: "A", compositeScore: 0.4, tradeSignal: "HOLD" }),
    category({ id: "B", compositeScore: 0.9, tradeSignal: "REDUCE" }),
    category({ id: "C", compositeScore: null, tradeSignal: "BUY" }),
  ];

  it("leaves the backend order alone by default", () => {
    const sorted = sortCategories(categories, "default", "desc", signalOf);
    expect(sorted).toBe(categories);
  });

  it("sorts by score in both directions, treating a missing score as the worst", () => {
    expect(sortCategories(categories, "score", "desc", signalOf).map(c => c.id)).toEqual(["B", "A", "C"]);
    expect(sortCategories(categories, "score", "asc", signalOf).map(c => c.id)).toEqual(["C", "A", "B"]);
  });

  it("sorts by signal priority: BUY before HOLD before REDUCE", () => {
    expect(sortCategories(categories, "signal", "asc", signalOf).map(c => c.id)).toEqual(["C", "A", "B"]);
  });

  it("sorts by win rate, ranking categories with no history last", () => {
    const winRates: Record<string, SignalWinRateDto> = {
      A: { winRate: 0.4 } as SignalWinRateDto,
      B: { winRate: 0.8 } as SignalWinRateDto,
    };
    expect(sortCategories(categories, "winrate", "desc", signalOf, winRates).map(c => c.id)).toEqual(["B", "A", "C"]);
  });

  it("does not mutate the input", () => {
    const input = [...categories];
    sortCategories(input, "score", "desc", signalOf);
    expect(input.map(c => c.id)).toEqual(["A", "B", "C"]);
  });
});

describe("buildRsRankPercentiles", () => {
  it("ranks the GICS sectors against each other and ignores everything else", () => {
    const percentiles = buildRsRankPercentiles([
      category({ id: "TECH", rs60: 0.05 }),
      category({ id: "ENRG", rs60: -0.02 }),
      category({ id: "GOLD", rs60: 0.9 }),
      category({ id: "HLTH", rs60: null }),
    ]);

    expect(percentiles.get("TECH")).toBe(100);
    expect(percentiles.get("ENRG")).toBe(50);
    expect(percentiles.has("GOLD")).toBe(false);
    expect(percentiles.has("HLTH")).toBe(false);
  });
});

describe("computeStreak", () => {
  it("counts consecutive moves in the current direction, signed by that direction", () => {
    expect(computeStreak([1, 2, 3, 4])).toBe(3);
    expect(computeStreak([4, 3, 2, 1])).toBe(-3);
    expect(computeStreak([1, 5, 4, 5])).toBe(1);
    expect(computeStreak([2, 2])).toBe(0);
    expect(computeStreak([1])).toBe(0);
  });
});

describe("findScoreExtreme", () => {
  it("prefers the backend's 252-day percentile and only reports the extremes", () => {
    expect(findScoreExtreme(category({ scorePercentile252d: 0.9 }), [])).toEqual({
      percentile: 90,
      isHigh: true,
      isFromBackend: true,
    });
    expect(findScoreExtreme(category({ scorePercentile252d: 0.1 }), [])).toEqual({
      percentile: 10,
      isHigh: false,
      isFromBackend: true,
    });
    expect(findScoreExtreme(category({ scorePercentile252d: 0.5 }), [])).toBeNull();
  });

  it("falls back to the score history when the backend has no percentile", () => {
    const history = [0.1, 0.2, 0.3, 0.4, 0.5];
    expect(findScoreExtreme(category({ compositeScore: 0.9 }), history)).toEqual({
      percentile: 100,
      isHigh: true,
      isFromBackend: false,
    });
    expect(findScoreExtreme(category({ compositeScore: 0.05 }), history)).toEqual({
      percentile: 0,
      isHigh: false,
      isFromBackend: false,
    });
    expect(findScoreExtreme(category({ compositeScore: 0.35 }), history)).toBeNull();
  });

  it("stays quiet without enough history or a score", () => {
    expect(findScoreExtreme(category({ compositeScore: 0.9 }), [0.1, 0.2])).toBeNull();
    expect(findScoreExtreme(category({ compositeScore: null }), [0.1, 0.2, 0.3, 0.4, 0.5])).toBeNull();
  });
});

describe("buildScoreTooltip", () => {
  it("explains every weighted component of the score", () => {
    const tooltip = buildScoreTooltip(
      category({ compositeScore: 0.72, rs60: 0.05, persistence20d: 14, persistence5d: 5, rrgQuadrant: "4" }),
      0.6,
    );
    expect(tooltip).toContain("Composite Score: 72/100");
    expect(tooltip).toContain("RS-60 (25% weight): +5.0%");
    expect(tooltip).toContain("14/20 days outperformed benchmark");
    expect(tooltip).toContain("Leading ↗");
    expect(tooltip).toContain("60% win rate in current regime");
    expect(tooltip).toContain("Breadth velocity");
  });

  it("says n/a rather than lying when data is missing", () => {
    const tooltip = buildScoreTooltip(category({}), null);
    expect(tooltip).toContain("Composite Score: —/100");
    expect(tooltip).toContain("n/a (computing)");
    expect(tooltip).not.toContain("Breadth velocity");
  });
});

describe("buildCategoriesCsv", () => {
  it("writes a header row and one row per visible category, in display order", () => {
    const csv = buildCategoriesCsv(
      [
        category({ id: "TECH", name: "Technology", etfTicker: "XLK", type: "EQUITY_SECTOR", latestClose: 210.5, compositeScore: 0.72, rs60: 0.051 }),
        category({ id: "ENRG", name: 'Energy "XLE"', etfTicker: "XLE", type: "EQUITY_SECTOR" }),
      ],
      "60d",
    );
    const lines = csv.split("\n");

    expect(lines[0]).toContain("RS-60d");
    expect(lines[1]).toBe('1,XLK,"Technology",EQUITY_SECTOR,210.50,72,5.1,,,,,');
    expect(lines[2]).toContain('"Energy ""XLE"""');
  });
});

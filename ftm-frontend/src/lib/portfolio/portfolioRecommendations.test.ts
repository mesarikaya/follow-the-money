import { CategorySummary, HoldingDto, PriceLevelDto, RebalanceSuggestion } from "@/lib/api";
import { entryQuality, nearPeakWarning, unownedBuySignals } from "./portfolioRecommendations";

const priceLevel = (drawdownFromHigh: number | null): PriceLevelDto =>
  ({ drawdownFromHigh }) as PriceLevelDto;

const suggestion = (overrides: Partial<RebalanceSuggestion>): RebalanceSuggestion =>
  ({ categoryId: "TECH", action: "INCREASE", signalAligned: true, ...overrides }) as RebalanceSuggestion;

const category = (overrides: Partial<CategorySummary>): CategorySummary =>
  ({
    id: "TECH",
    compositeScore: 0.8,
    tradeSignal: "BUY",
    rrgQuadrant: null,
    compositeTrend20d: null,
    ...overrides,
  }) as CategorySummary;

describe("entryQuality", () => {
  it("warns when a buy is chasing a 52-week high", () => {
    expect(entryQuality(priceLevel(-0.02), true)!.label).toBe("near peak");
  });

  it("flags a deep pullback as a potential value entry", () => {
    const quality = entryQuality(priceLevel(-0.22), true)!;
    expect(quality.label).toBe("-22% pullback");
    expect(quality.title).toContain("value entry");
  });

  it("calls anything in between a moderate pullback", () => {
    expect(entryQuality(priceLevel(-0.1), true)!.label).toBe("-10% off high");
  });

  it("says nothing when we are selling, or have no prices", () => {
    expect(entryQuality(priceLevel(-0.02), false)).toBeNull();
    expect(entryQuality(undefined, true)).toBeNull();
    expect(entryQuality(priceLevel(null), true)).toBeNull();
  });
});

describe("nearPeakWarning", () => {
  const levels = {
    TECH: priceLevel(-0.01),
    FINL: priceLevel(-0.03),
    ENRG: priceLevel(-0.30),
  };

  it("warns once at least two confirmed buys are near their highs", () => {
    const warning = nearPeakWarning(
      [
        suggestion({ categoryId: "TECH" }),
        suggestion({ categoryId: "FINL" }),
        suggestion({ categoryId: "ENRG" }),
      ],
      levels,
    )!;

    expect(warning).toEqual({ nearPeakCount: 2, buyCount: 3 });
  });

  it("stays quiet for a single one", () => {
    expect(nearPeakWarning([suggestion({ categoryId: "TECH" })], levels)).toBeNull();
  });

  it("ignores decreases and unconfirmed suggestions", () => {
    expect(
      nearPeakWarning(
        [
          suggestion({ categoryId: "TECH", action: "DECREASE" }),
          suggestion({ categoryId: "FINL", signalAligned: false }),
        ],
        levels,
      ),
    ).toBeNull();
  });
});

describe("unownedBuySignals", () => {
  const holding = (categoryId: string | null): HoldingDto => ({ categoryId }) as HoldingDto;

  it("returns the strongest BUY categories the portfolio does not hold", () => {
    const categories = {
      TECH: category({ id: "TECH", compositeScore: 0.9 }),
      FINL: category({ id: "FINL", compositeScore: 0.7 }),
      ENRG: category({ id: "ENRG", compositeScore: 0.95 }),
      UTIL: category({ id: "UTIL", tradeSignal: "REDUCE", compositeScore: 0.2 }),
    };

    const radar = unownedBuySignals(categories, [holding("TECH"), holding(null)]);

    expect(radar.map(c => c.id)).toEqual(["ENRG", "FINL"]);
  });

  it("shows at most five", () => {
    const many = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [`C${i}`, category({ id: `C${i}`, compositeScore: i / 10 })]),
    );
    expect(unownedBuySignals(many, [])).toHaveLength(5);
  });
});

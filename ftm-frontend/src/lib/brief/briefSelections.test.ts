import { AlertDto, CategorySummary, PortfolioSnapshot } from "@/lib/api";
import {
  countAlerts,
  fallingFast,
  portfolioDayChangePct,
  risingFast,
  topBuys,
  topExits,
  topWatches,
} from "./briefSelections";

const category = (
  id: string,
  tradeSignal: string | null,
  compositeScore: number | null,
  compositeTrend5d: number | null = null,
): CategorySummary => ({ id, tradeSignal, compositeScore, compositeTrend5d }) as CategorySummary;

describe("topBuys / topWatches", () => {
  const categories = [
    category("A", "BUY", 0.7),
    category("B", "BUY", 0.9),
    category("C", "WATCH", 0.6),
    category("D", "BUY", null),
  ];

  it("takes the strongest BUYs, and ignores one with no score", () => {
    expect(topBuys(categories).map(c => c.id)).toEqual(["B", "A"]);
  });

  it("takes the strongest WATCHes", () => {
    expect(topWatches(categories).map(c => c.id)).toEqual(["C"]);
  });
});

describe("topExits", () => {
  it("takes the REDUCEs plus the HOLDs that have decayed below the weak threshold", () => {
    const exits = topExits([
      category("REDUCE_ONE", "REDUCE", 0.3),
      category("WEAK_HOLD", "HOLD", 0.2),
      category("FINE_HOLD", "HOLD", 0.5),
      category("BUY_ONE", "BUY", 0.9),
    ]);

    // Weakest first — the most urgent thing to leave.
    expect(exits.map(c => c.id)).toEqual(["WEAK_HOLD", "REDUCE_ONE"]);
  });
});

describe("movers", () => {
  const categories = [
    category("UP", "BUY", 0.7, 0.01), // 5d move: +5pt
    category("FLAT", "HOLD", 0.5, 0.001), // 5d move: +0.5pt — below the threshold
    category("DOWN", "REDUCE", 0.3, -0.02), // 5d move: −10pt
  ];

  it("reports the five-day move, not the per-day trend", () => {
    const [riser] = risingFast(categories);
    expect(riser.cat.id).toBe("UP");
    expect(riser.delta).toBeCloseTo(0.05);
  });

  it("ignores anything that has barely moved", () => {
    expect(risingFast(categories).map(m => m.cat.id)).toEqual(["UP"]);
    expect(fallingFast(categories).map(m => m.cat.id)).toEqual(["DOWN"]);
  });
});

describe("portfolioDayChangePct", () => {
  const snapshot = (totalValueEur: number): PortfolioSnapshot => ({ totalValueEur }) as PortfolioSnapshot;

  it("compares the last two snapshots", () => {
    expect(portfolioDayChangePct([snapshot(100), snapshot(110)])).toBeCloseTo(10);
    expect(portfolioDayChangePct([snapshot(100), snapshot(90)])).toBeCloseTo(-10);
  });

  it("needs two snapshots, and will not divide by zero", () => {
    expect(portfolioDayChangePct([snapshot(100)])).toBeNull();
    expect(portfolioDayChangePct([])).toBeNull();
    expect(portfolioDayChangePct([snapshot(0), snapshot(100)])).toBeNull();
  });
});

describe("countAlerts", () => {
  it("counts URGENT alongside ACTION — both mean act today", () => {
    const alert = (severity: string) => ({ severity }) as AlertDto;

    expect(
      countAlerts([alert("URGENT"), alert("ACTION"), alert("WARNING"), alert("INFO"), alert("INFO")]),
    ).toEqual({ action: 2, warning: 1, info: 2 });
  });
});

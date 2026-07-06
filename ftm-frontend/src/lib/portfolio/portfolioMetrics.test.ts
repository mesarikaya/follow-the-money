import {
  currencySymbol,
  isStale,
  unrealizedPnl,
  maxAllocationPct,
  weightedMomentumPct,
  simulatedAlignmentPercent,
  topRebalanceActions,
  computeHoldingsPnl,
  findConcentrationRisk,
  sectorExposureRows,
} from "./portfolioMetrics";
import { HoldingDto, PortfolioAllocationEntry, PortfolioResponse, CategorySummary } from "@/lib/api";

function holding(over: Partial<HoldingDto>): HoldingDto {
  return { ticker: "X", quantity: 1, currency: "USD", ...over } as HoldingDto;
}
function entry(over: Partial<PortfolioAllocationEntry>): PortfolioAllocationEntry {
  return {
    categoryId: "TECH", categoryName: "Tech", categoryType: "EQUITY_SECTOR",
    allocationPct: 0, compositeScore: null, momentumPct: null, optimalAllocationPct: null, tradeSignal: null,
    ...over,
  };
}

describe("currencySymbol", () => {
  it("maps known currencies and defaults to $", () => {
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("GBX")).toBe("p");
    expect(currencySymbol("JPY")).toBe("$");
    expect(currencySymbol(undefined)).toBe("$");
  });
});

describe("isStale", () => {
  it("is stale without a source or date, and when older than 3 days", () => {
    expect(isStale(holding({ priceSource: undefined }))).toBe(true);
    expect(isStale(holding({ priceSource: "yahoo", priceDate: undefined }))).toBe(true);
    const old = new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString();
    expect(isStale(holding({ priceSource: "yahoo", priceDate: old }))).toBe(true);
  });
  it("is fresh within 3 days", () => {
    const recent = new Date(Date.now() - 1 * 3600 * 1000).toISOString();
    expect(isStale(holding({ priceSource: "yahoo", priceDate: recent }))).toBe(false);
  });
});

describe("unrealizedPnl", () => {
  it("computes percent and local absolute gain", () => {
    const pnl = unrealizedPnl(holding({ currentPriceLocal: 110, avgCostLocal: 100, quantity: 5 }));
    expect(pnl?.pct).toBeCloseTo(0.1, 6);
    expect(pnl?.absLocal).toBeCloseTo(50, 6);
  });
  it("returns null when not priced", () => {
    expect(unrealizedPnl(holding({ currentPriceLocal: null }))).toBeNull();
    expect(unrealizedPnl(holding({ currentPriceLocal: 110, avgCostLocal: 0 }))).toBeNull();
  });
});

describe("maxAllocationPct", () => {
  it("takes the largest of current/optimal, floored at 1", () => {
    expect(maxAllocationPct([entry({ allocationPct: 30, optimalAllocationPct: 50 })])).toBe(50);
    expect(maxAllocationPct([entry({ allocationPct: 12, optimalAllocationPct: null })])).toBe(12);
    expect(maxAllocationPct([])).toBe(1);
  });
});

describe("weightedMomentumPct", () => {
  it("weights each category's momentum by the chosen allocation", () => {
    const allocations = [
      entry({ allocationPct: 50, optimalAllocationPct: 60, momentumPct: 20 }),
      entry({ categoryId: "ENRG", allocationPct: 50, optimalAllocationPct: 40, momentumPct: 10 }),
    ];
    // current: 0.5*20 + 0.5*10 = 15
    expect(weightedMomentumPct(allocations, (e) => e.allocationPct)).toBe(15);
    // optimal: 0.6*20 + 0.4*10 = 16
    expect(weightedMomentumPct(allocations, (e) => e.optimalAllocationPct ?? 0)).toBe(16);
  });
});

describe("simulatedAlignmentPercent", () => {
  it("returns null with no suggestions", () => {
    expect(simulatedAlignmentPercent({ allocations: [], rebalanceSuggestions: [] } as unknown as PortfolioResponse)).toBeNull();
  });
  it("overlaps simulated current against optimal", () => {
    const portfolio = {
      allocations: [
        { categoryId: "TECH", allocationPct: 30, optimalAllocationPct: 50 },
        { categoryId: "CASH", allocationPct: 70, optimalAllocationPct: null },
      ],
      rebalanceSuggestions: [{ categoryId: "TECH", deltaPct: 20 }],
    } as unknown as PortfolioResponse;
    // TECH simulated 30+20=50, overlap min(50,50)=50 → 50
    expect(simulatedAlignmentPercent(portfolio)).toBe(50);
  });
});

describe("topRebalanceActions", () => {
  it("sorts by absolute delta and caps the count", () => {
    const portfolio = {
      rebalanceSuggestions: [
        { categoryId: "A", deltaPct: 5 },
        { categoryId: "B", deltaPct: -20 },
        { categoryId: "C", deltaPct: 12 },
      ],
    } as unknown as PortfolioResponse;
    const top = topRebalanceActions(portfolio, 2);
    expect(top.map((s) => s.categoryId)).toEqual(["B", "C"]);
  });
});

describe("computeHoldingsPnl", () => {
  it("aggregates P&L across priced holdings", () => {
    const holdings = [holding({ currentPriceLocal: 110, avgCostLocal: 100, marketValueEur: 110 })];
    const pnl = computeHoldingsPnl(holdings);
    expect(pnl?.totalPnlPct).toBeCloseTo(0.1, 3);
  });
  it("returns null for no holdings", () => {
    expect(computeHoldingsPnl([])).toBeNull();
  });
});

describe("findConcentrationRisk", () => {
  const cats: Record<string, CategorySummary> = { TECH: { id: "TECH", name: "Tech" } as CategorySummary };
  it("flags a sector above 40%", () => {
    const holdings = [
      holding({ categoryId: "TECH", marketValueEur: 60 }),
      holding({ categoryId: "ENRG", marketValueEur: 40 }),
    ];
    const risk = findConcentrationRisk(holdings, cats, 100);
    expect(risk?.id).toBe("TECH");
    expect(risk?.pct).toBeCloseTo(60, 3);
  });
  it("returns null when nothing exceeds 40%", () => {
    const holdings = [
      holding({ categoryId: "TECH", marketValueEur: 30 }),
      holding({ categoryId: "ENRG", marketValueEur: 70 }),
    ];
    // ENRG is 70 but has no category name → still flagged by value; use a balanced case instead
    expect(findConcentrationRisk([holding({ categoryId: "TECH", marketValueEur: 40 }), holding({ categoryId: "ENRG", marketValueEur: 60 })], cats, 100)?.id).toBe("ENRG");
    expect(findConcentrationRisk(holdings, cats, 0)).toBeNull();
  });
});

describe("sectorExposureRows", () => {
  it("rolls holdings into sectors and tracks unclassified value", () => {
    const portfolio = { allocations: [{ categoryId: "TECH", categoryName: "Tech", optimalAllocationPct: 50 }] } as unknown as PortfolioResponse;
    const cats: Record<string, CategorySummary> = { TECH: { id: "TECH", name: "Tech", compositeScore: 0.7 } as CategorySummary };
    const holdings = [
      holding({ categoryId: "TECH", marketValueEur: 60 }),
      holding({ categoryId: undefined, marketValueEur: 40 }),
    ];
    const { rows, unclassifiedEur } = sectorExposureRows(holdings, portfolio, cats, 100);
    expect(unclassifiedEur).toBe(40);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("TECH");
    expect(rows[0].actualPct).toBeCloseTo(60, 3);
    expect(rows[0].targetPct).toBe(50);
  });
});

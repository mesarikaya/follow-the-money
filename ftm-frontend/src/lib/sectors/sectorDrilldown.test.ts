import { SubSectorSummary } from "@/lib/api";
import { breakDownSubSectors, buildConfluenceNarrative } from "./sectorDrilldown";

const subSector = (overrides: Partial<SubSectorSummary>): SubSectorSummary =>
  ({
    id: "S",
    etfTicker: "XX",
    rrgQuadrant: null,
    tradeSignal: null,
    compositeScore: null,
    compositeTrend20d: null,
    ...overrides,
  }) as SubSectorSummary;

describe("breakDownSubSectors", () => {
  it("groups by quadrant and signal, and counts the bulls and bears", () => {
    const breakdown = breakDownSubSectors([
      subSector({ rrgQuadrant: "4", tradeSignal: "BUY" }),
      subSector({ rrgQuadrant: "3", tradeSignal: "WATCH" }),
      subSector({ rrgQuadrant: "2", tradeSignal: "HOLD" }),
      subSector({ rrgQuadrant: "1", tradeSignal: "REDUCE" }),
      subSector({ rrgQuadrant: null, tradeSignal: "BUY" }),
    ]);

    expect(breakdown.bullishCount).toBe(2);
    expect(breakdown.bearishCount).toBe(2);
    expect(breakdown.ratedCount).toBe(4);
    expect(breakdown.bySignal.BUY).toHaveLength(2);
  });
});

describe("buildConfluenceNarrative", () => {
  const breakdownOf = (bullish: number, bearish: number, buys = 0) =>
    breakDownSubSectors([
      ...Array.from({ length: bullish }, () =>
        subSector({ rrgQuadrant: "4", tradeSignal: "HOLD" }),
      ),
      ...Array.from({ length: bearish }, () => subSector({ rrgQuadrant: "1", tradeSignal: "HOLD" })),
      ...Array.from({ length: buys }, () => subSector({ rrgQuadrant: "3", tradeSignal: "BUY" })),
    ]);

  it("says nothing about a sector with no rotation readings", () => {
    expect(buildConfluenceNarrative(breakDownSubSectors([]), "Energy")).toBeNull();
  });

  it("calls a sector rotating together strong, and names the confirming BUYs", () => {
    const narrative = buildConfluenceNarrative(breakdownOf(3, 0, 1), "Energy")!;
    expect(narrative.strength).toBe("strong");
    expect(narrative.text).toContain("1 BUY signal confirm");
  });

  it("grades the middle ground moderate, then mixed", () => {
    expect(buildConfluenceNarrative(breakdownOf(3, 3), "Energy")!.strength).toBe("moderate");
    expect(buildConfluenceNarrative(breakdownOf(1, 3), "Energy")!.strength).toBe("mixed");
  });

  it("calls a sector rolling over weak", () => {
    const narrative = buildConfluenceNarrative(breakdownOf(0, 4), "Energy")!;
    expect(narrative.strength).toBe("weak");
    expect(narrative.text).toContain("broad deterioration");
  });
});

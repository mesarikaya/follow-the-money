import { CategorySummary } from "@/lib/api";
import { hasSectorDrilldown, readLiveSignals } from "./liveSignals";

const category = (id: string, tradeSignal: string | null, compositeScore: number | null): CategorySummary =>
  ({ id, tradeSignal, compositeScore, rrgQuadrant: null, compositeTrend20d: null }) as CategorySummary;

describe("hasSectorDrilldown", () => {
  it("is true only for the top-level equity sectors", () => {
    expect(hasSectorDrilldown("TECH")).toBe(true);
    expect(hasSectorDrilldown("TECH_SEMI")).toBe(false); // a sub-sector
    expect(hasSectorDrilldown("GOLD")).toBe(false); // not an equity sector
    expect(hasSectorDrilldown("CASH")).toBe(false);
  });
});

describe("readLiveSignals", () => {
  const categories = [
    category("TECH", "BUY", 0.8),
    category("FINL", "BUY", 0.9),
    category("ENRG", "WATCH", 0.6),
    category("UTIL", "REDUCE", 0.2),
  ];

  it("groups the categories by signal, strongest first", () => {
    const live = readLiveSignals(categories, 3);

    expect(live.buy.map(c => c.id)).toEqual(["FINL", "TECH"]);
    expect(live.watch.map(c => c.id)).toEqual(["ENRG"]);
    expect(live.reduce.map(c => c.id)).toEqual(["UTIL"]);
  });

  it("picks what the strategy would hold today — the best BUY and WATCH names, capped at topN", () => {
    expect(readLiveSignals(categories, 2).topPicks.map(c => c.id)).toEqual(["FINL", "TECH"]);
    expect(readLiveSignals(categories, 5).topPicks.map(c => c.id)).toEqual(["FINL", "TECH", "ENRG"]);
  });

  it("knows when there is nothing to show", () => {
    expect(readLiveSignals([], 3).hasData).toBe(false);
    expect(readLiveSignals([category("TECH", null, null)], 3).hasData).toBe(false);
    expect(readLiveSignals(categories, 3).hasData).toBe(true);
  });
});

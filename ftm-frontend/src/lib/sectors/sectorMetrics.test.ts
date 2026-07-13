import { AlertDto, CategorySummary, SubSectorSummary } from "@/lib/api";
import {
  buildSubSectorBreakdown,
  hasCrossHorizonDivergence,
  rsHorizonAlignment,
  summarizeSectors,
  worstSeverity,
} from "./sectorMetrics";

function sector(overrides: Partial<CategorySummary>): CategorySummary {
  return {
    id: "TECH",
    etfTicker: "XLK",
    rrgQuadrant: null,
    tradeSignal: null,
    compositeScore: null,
    compositeTrend20d: null,
    rs20: null,
    rs60: null,
    rs120: null,
    ...overrides,
  } as CategorySummary;
}

function subSector(rrgQuadrant: string | null): SubSectorSummary {
  return { rrgQuadrant } as SubSectorSummary;
}

describe("buildSubSectorBreakdown", () => {
  it("counts sub-sectors by quadrant and treats anything unknown as no data", () => {
    const breakdown = buildSubSectorBreakdown([
      subSector("4"),
      subSector("4"),
      subSector("3"),
      subSector("2"),
      subSector("1"),
      subSector(null),
      subSector("9"),
    ]);

    expect(breakdown).toEqual({
      leading: 2,
      improving: 1,
      weakening: 1,
      lagging: 1,
      noData: 2,
      total: 7,
    });
  });
});

describe("worstSeverity", () => {
  const alert = (severity: string) => ({ severity }) as AlertDto;

  it("returns the most severe level present", () => {
    expect(worstSeverity([alert("INFO"), alert("URGENT"), alert("WARNING")])).toBe("URGENT");
    expect(worstSeverity([alert("INFO"), alert("WARNING")])).toBe("WARNING");
    expect(worstSeverity([])).toBeNull();
  });
});

describe("relative-strength horizons", () => {
  it("spots a short-term direction that contradicts the medium-term one", () => {
    expect(hasCrossHorizonDivergence(sector({ rs20: 0.05, rs60: 0.02, rs120: 0.04 }))).toBe(true);
    expect(hasCrossHorizonDivergence(sector({ rs20: 0.01, rs60: 0.04, rs120: 0.02 }))).toBe(true);
    expect(hasCrossHorizonDivergence(sector({ rs20: 0.06, rs60: 0.04, rs120: 0.02 }))).toBe(false);
    expect(hasCrossHorizonDivergence(sector({ rs20: 0.06, rs60: 0.04, rs120: null }))).toBe(false);
  });

  it("reports alignment only when all three horizons agree", () => {
    expect(rsHorizonAlignment(sector({ rs20: 0.06, rs60: 0.04, rs120: 0.02 }))).toBe("BULLISH");
    expect(rsHorizonAlignment(sector({ rs20: -0.06, rs60: -0.04, rs120: -0.02 }))).toBe("BEARISH");
    expect(rsHorizonAlignment(sector({ rs20: 0.06, rs60: 0.02, rs120: 0.04 }))).toBeNull();
    expect(rsHorizonAlignment(sector({ rs20: null, rs60: 0.02, rs120: 0.04 }))).toBeNull();
  });
});

describe("summarizeSectors", () => {
  it("groups tickers by quadrant and signal, and averages the scores", () => {
    const summary = summarizeSectors([
      sector({ id: "A", etfTicker: "XLK", rrgQuadrant: "4", tradeSignal: "BUY", compositeScore: 0.8 }),
      sector({ id: "B", etfTicker: "XLV", rrgQuadrant: "3", tradeSignal: "WATCH", compositeScore: 0.6 }),
      sector({ id: "C", etfTicker: "XLE", rrgQuadrant: "1", tradeSignal: "REDUCE", compositeScore: 0.4 }),
    ]);

    expect(summary.tickersByQuadrant["4"]).toEqual(["XLK"]);
    expect(summary.tickersBySignal.BUY).toEqual(["XLK"]);
    expect(summary.tickersBySignal.REDUCE).toEqual(["XLE"]);
    expect(summary.averageScore).toBe(60);
    expect(summary.bullishCount).toBe(2);
    expect(summary.hasQuadrantData).toBe(true);
  });

  it("calls the market by how many sectors are leading or improving", () => {
    const leading = (index: number) =>
      sector({ id: `L${index}`, etfTicker: `L${index}`, rrgQuadrant: "4" });

    expect(summarizeSectors(Array.from({ length: 7 }, (_, i) => leading(i))).marketBias).toBe("Broad Bull");
    expect(summarizeSectors(Array.from({ length: 4 }, (_, i) => leading(i))).marketBias).toBe("Mixed");
    expect(summarizeSectors(Array.from({ length: 3 }, (_, i) => leading(i))).marketBias).toBe("Broad Bear");
  });

  it("has nothing to say about an empty market", () => {
    const summary = summarizeSectors([]);
    expect(summary.averageScore).toBeNull();
    expect(summary.hasQuadrantData).toBe(false);
    expect(summary.marketBias).toBe("Broad Bear");
  });
});

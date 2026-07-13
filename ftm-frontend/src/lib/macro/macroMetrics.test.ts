import { MacroIndicators, MacroSeriesPoint } from "@/lib/api";
import {
  MacroHistory,
  computeMacroStress,
  realYield,
  realYieldHistory,
  yieldCurveShape,
} from "./macroMetrics";

function indicators(overrides: Partial<MacroIndicators> = {}): MacroIndicators {
  return {
    vix: null,
    yieldSpread10y2y: null,
    usdIndex: null,
    breakevenInflation: null,
    fedFundsRate: null,
    tenYearYield: null,
    twoYearYield: null,
    wtiCrudeOilPrice: null,
    ...overrides,
  };
}

function series(values: number[], startDay = 1): MacroSeriesPoint[] {
  return values.map((value, i) => ({ date: `2026-01-${String(startDay + i).padStart(2, "0")}`, value }));
}

describe("computeMacroStress", () => {
  it("scores a calm market low and a panicking one high", () => {
    const flatVix: MacroHistory = { VIXCLS: series(Array(30).fill(15)) };

    const calm = computeMacroStress(flatVix, indicators({ vix: 15, yieldSpread10y2y: 1.0, breakevenInflation: 2.2 }));
    const panic = computeMacroStress(
      { VIXCLS: series([...Array(29).fill(15), 40]) },
      // Deeply inverted curve and a VIX far above its own average.
      indicators({ vix: 40, yieldSpread10y2y: -1.5, breakevenInflation: 2.2 }),
    );

    expect(calm.score).toBeLessThan(panic.score);
    expect(panic.score).toBeGreaterThan(70);
  });

  it("treats a normal yield curve as no stress at all, and an inverted one as stress", () => {
    const normal = computeMacroStress({}, indicators({ yieldSpread10y2y: 1.5 }));
    const inverted = computeMacroStress({}, indicators({ yieldSpread10y2y: -1.5 }));

    expect(normal.components.find(c => c.label === "Yield Curve")!.score).toBe(0);
    expect(inverted.components.find(c => c.label === "Yield Curve")!.score).toBe(100);
  });

  it("needs 20 points before it trusts a z-score", () => {
    const tooShort = computeMacroStress({ VIXCLS: series([10, 50]) }, indicators({ vix: 50 }));
    // With no usable history the VIX component sits at the neutral midpoint.
    expect(tooShort.components.find(c => c.label === "VIX")!.score).toBe(50);
  });

  it("weights the four components to 100", () => {
    const { components } = computeMacroStress({}, indicators());
    expect(components.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });
});

describe("yieldCurveShape", () => {
  it("calls the curve by the gap between its ends", () => {
    expect(yieldCurveShape(indicators({ tenYearYield: 4.5, twoYearYield: 3.5, fedFundsRate: 3.0 }))).toBe("Normal");
    expect(yieldCurveShape(indicators({ tenYearYield: 4.0, twoYearYield: 4.1, fedFundsRate: 3.9 }))).toBe("Flat");
    expect(yieldCurveShape(indicators({ tenYearYield: 3.5, twoYearYield: 4.5, fedFundsRate: 4.4 }))).toBe("Inverted");
  });

  it("counts a 10Y below the Fed Funds rate as inverted too", () => {
    expect(yieldCurveShape(indicators({ tenYearYield: 4.0, twoYearYield: 4.0, fedFundsRate: 5.0 }))).toBe("Inverted");
  });
});

describe("real yield", () => {
  it("takes inflation expectations out of the nominal yield", () => {
    expect(realYield(indicators({ tenYearYield: 4.2, breakevenInflation: 2.4 }))).toBeCloseTo(1.8);
    expect(realYield(indicators({ tenYearYield: null, breakevenInflation: 2.4 }))).toBeNull();
  });

  it("builds its history only from days where both series have a reading", () => {
    const history: MacroHistory = {
      DGS10: [
        { date: "2026-01-01", value: 4.0 },
        { date: "2026-01-03", value: 4.2 },
      ],
      T10YIE: [
        { date: "2026-01-01", value: 2.0 },
        { date: "2026-01-02", value: 2.1 },
        { date: "2026-01-03", value: 2.2 },
      ],
    };

    const result = realYieldHistory(history);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(2.0);
    expect(result[1]).toBeCloseTo(2.0);
  });
});

import { EquityCurvePoint } from "@/lib/api";
import {
  computeAnnualReturns,
  computeDrawdownPeriods,
  computeMonthlyReturns,
  computeRegimeBreakdown,
  computeRiskAttribution,
  computeSortino,
} from "./metrics";

function pt(date: string, portfolioValue: number, spyValue: number): EquityCurvePoint {
  return { date, portfolioValue, spyValue } as EquityCurvePoint;
}

describe("computeDrawdownPeriods", () => {
  it("returns [] for a too-short curve", () => {
    expect(computeDrawdownPeriods([pt("2020-01-01", 100, 100)])).toEqual([]);
  });

  it("captures a peak→trough→recovery drawdown ≥2% with correct depth and dates", () => {
    // 100 → 110 (peak) → 99 (trough, -10%) → 112 (recovers above peak)
    const curve = [
      pt("2020-01-01", 100, 100),
      pt("2020-01-02", 110, 100),
      pt("2020-01-03", 104, 100),
      pt("2020-01-04", 99, 100),
      pt("2020-01-05", 112, 100),
    ];
    const dds = computeDrawdownPeriods(curve);
    expect(dds).toHaveLength(1);
    expect(dds[0].startDate).toBe("2020-01-02"); // the peak
    expect(dds[0].troughDate).toBe("2020-01-04");
    expect(dds[0].endDate).toBe("2020-01-05"); // recovery day
    expect(dds[0].depthPct).toBeCloseTo(10, 5);
  });

  it("ignores shallow (<2%) dips", () => {
    const curve = [pt("2020-01-01", 100, 100), pt("2020-01-02", 99.5, 100), pt("2020-01-03", 101, 100)];
    expect(computeDrawdownPeriods(curve)).toEqual([]);
  });

  it("reports an unrecovered drawdown with null endDate/recoveryDays", () => {
    const curve = [pt("2020-01-01", 100, 100), pt("2020-01-02", 120, 100), pt("2020-01-03", 90, 100)];
    const dds = computeDrawdownPeriods(curve);
    expect(dds).toHaveLength(1);
    expect(dds[0].endDate).toBeNull();
    expect(dds[0].recoveryDays).toBeNull();
    expect(dds[0].depthPct).toBeCloseTo(25, 5); // 1 - 90/120
  });
});

describe("computeSortino", () => {
  it("returns null when there is no downside (never negative)", () => {
    const curve = [pt("d1", 100, 1), pt("d2", 101, 1), pt("d3", 102, 1)];
    expect(computeSortino(curve, false)).toBeNull();
  });

  it("is negative when the mean return is negative", () => {
    const curve = [pt("d1", 100, 1), pt("d2", 95, 1), pt("d3", 90, 1)];
    const s = computeSortino(curve, false);
    expect(s).not.toBeNull();
    expect(s as number).toBeLessThan(0);
  });

  it("reads the SPY series when useSpy=true", () => {
    const curve = [pt("d1", 100, 100), pt("d2", 100, 90), pt("d3", 100, 80)];
    // portfolio flat → null; spy falling → negative
    expect(computeSortino(curve, false)).toBeNull();
    expect(computeSortino(curve, true) as number).toBeLessThan(0);
  });
});

describe("computeMonthlyReturns", () => {
  it("computes month-over-month returns from each month's last point", () => {
    const curve = [
      pt("2020-01-15", 100, 200),
      pt("2020-01-31", 110, 210), // Jan close
      pt("2020-02-28", 121, 210), // Feb close
    ];
    const rows = computeMonthlyReturns(curve);
    expect(rows).toHaveLength(1); // first month has no prior to compare
    expect(rows[0].ym).toBe("2020-02");
    expect(rows[0].port).toBeCloseTo(0.1, 5); // 121/110 - 1
    expect(rows[0].spy).toBeCloseTo(0, 5); // 210/210 - 1
  });
});

describe("computeAnnualReturns", () => {
  it("chains each year off the prior year's last month-end", () => {
    const curve = [
      pt("2020-12-31", 100, 100),
      pt("2021-06-30", 120, 100),
      pt("2021-12-31", 150, 110),
    ];
    const rows = computeAnnualReturns(curve);
    const y2021 = rows.find(r => r.yr === 2021)!;
    expect(y2021.port).toBeCloseTo(0.5, 5); // 150/100 - 1
    expect(y2021.spy).toBeCloseTo(0.1, 5); // 110/100 - 1
  });
});

describe("computeRiskAttribution", () => {
  it("returns null for fewer than 30 points", () => {
    expect(computeRiskAttribution([pt("d1", 100, 100), pt("d2", 101, 101)])).toBeNull();
  });

  it("gives beta≈1 and correlation≈1 when the portfolio tracks SPY exactly", () => {
    const curve: EquityCurvePoint[] = [];
    let p = 100;
    for (let i = 0; i < 40; i++) {
      p *= i % 2 === 0 ? 1.01 : 0.995;
      curve.push(pt(`2020-01-${i + 1}`, p, p));
    }
    const ra = computeRiskAttribution(curve)!;
    expect(ra).not.toBeNull();
    expect(ra.beta as number).toBeCloseTo(1, 3);
    expect(ra.correlation as number).toBeCloseTo(1, 3);
  });
});

describe("computeRegimeBreakdown", () => {
  it("returns [] without history", () => {
    expect(computeRegimeBreakdown([pt("d1", 100, 100), pt("d2", 101, 101)], [])).toEqual([]);
  });

  it("attributes compounded return to the regime covering each date", () => {
    const curve = [
      pt("2022-01-03", 100, 100),
      pt("2022-01-10", 110, 105),
      pt("2022-02-01", 90, 108),
    ];
    const history = [
      { date: "2022-01-01", regime: "RISK_ON_GROWTH" },
      { date: "2022-01-20", regime: "RISK_OFF_FLIGHT" },
    ];
    const rows = computeRegimeBreakdown(curve, history);
    const growth = rows.find(r => r.regime === "RISK_ON_GROWTH")!;
    // 2022-01-03 and 2022-01-10 fall in RISK_ON_GROWTH: 100 → 110 = +10%
    expect(growth.days).toBe(2);
    expect(growth.portReturn).toBeCloseTo(10, 5);
  });
});

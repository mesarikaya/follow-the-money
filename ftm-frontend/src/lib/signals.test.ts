import {
  computeBreadthVelocity,
  deriveTradeSignal,
  countBuyConditions,
  missingBuyConditions,
  SignalSource,
} from "./signals";

// Mirrors the backend TradeSignalDeriverTest so the duplicated frontend logic cannot silently
// drift from com.ftm.app.api.service.TradeSignalDeriver.
const src = (
  compositeScore: number | null,
  rrgQuadrant: string | null,
  compositeTrend20d: number | null,
): SignalSource => ({ compositeScore, rrgQuadrant, compositeTrend20d });

describe("deriveTradeSignal", () => {
  it("returns null when composite score is null", () => {
    expect(deriveTradeSignal(src(null, "4", 0.01))).toBeNull();
  });

  it("returns BUY when score >= 0.65, improving quadrant (3/4), trend positive", () => {
    expect(deriveTradeSignal(src(0.75, "4", 0.02))).toBe("BUY");
    expect(deriveTradeSignal(src(0.65, "3", 0.01))).toBe("BUY");
  });

  it("returns BUY at the exact 0.65 boundary", () => {
    expect(deriveTradeSignal(src(0.65, "3", 0.001))).toBe("BUY");
  });

  it("returns WATCH (not BUY) at 0.65 when trend is missing", () => {
    expect(deriveTradeSignal(src(0.65, "3", null))).toBe("WATCH");
  });

  it("returns WATCH when score >= 0.50 and improving, even if trend is negative", () => {
    expect(deriveTradeSignal(src(0.6, "4", -0.01))).toBe("WATCH");
  });

  it("returns WATCH when score >= 0.50 and trend positive, even if lagging", () => {
    expect(deriveTradeSignal(src(0.55, "1", 0.01))).toBe("WATCH");
  });

  it("returns REDUCE when score < 0.35 and weakening (1/2)", () => {
    expect(deriveTradeSignal(src(0.3, "1", null))).toBe("REDUCE");
    expect(deriveTradeSignal(src(0.34, "2", -0.02))).toBe("REDUCE");
  });

  it("returns HOLD for a mid-range score with no directional signal", () => {
    expect(deriveTradeSignal(src(0.45, "1", -0.01))).toBe("HOLD");
  });

  it("returns HOLD when score < 0.35 but the quadrant is not weakening", () => {
    expect(deriveTradeSignal(src(0.3, "4", null))).toBe("HOLD");
  });

  it("handles a null rrgQuadrant (WATCH via trend)", () => {
    expect(deriveTradeSignal(src(0.6, null, 0.01))).toBe("WATCH");
  });
});

describe("countBuyConditions", () => {
  it("counts score>=0.65, improving quadrant, and positive trend", () => {
    expect(countBuyConditions(src(0.7, "4", 0.02))).toBe(3);
    expect(countBuyConditions(src(0.6, "1", 0.01))).toBe(1); // only trend
    expect(countBuyConditions(src(0.3, "1", -0.01))).toBe(0);
  });

  it("returns 0 when score is null", () => {
    expect(countBuyConditions(src(null, "4", 0.02))).toBe(0);
  });
});

describe("missingBuyConditions", () => {
  it("lists nothing when all BUY conditions are met", () => {
    expect(missingBuyConditions(src(0.7, "4", 0.02))).toEqual([]);
  });

  it("lists each unmet condition", () => {
    const missing = missingBuyConditions(src(0.5, "1", -0.01));
    expect(missing).toContain("RRG not improving");
    expect(missing).toContain("trend negative");
    expect(missing.some((m) => m.includes("<65"))).toBe(true);
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

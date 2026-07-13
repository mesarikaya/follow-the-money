import { ThemeDetail, ThemeHistoryPoint } from "@/lib/api";
import {
  compareHigher,
  compareLower,
  compareOrdered,
  compareThemes,
  scoreDeltaOver5Days,
} from "./themeComparison";

function history(scores: number[]): ThemeHistoryPoint[] {
  return scores.map(compositeScore => ({ compositeScore }) as ThemeHistoryPoint);
}

function theme(overrides: Partial<ThemeDetail>): ThemeDetail {
  return {
    id: "T",
    name: "Theme",
    dominantSignal: "HOLD",
    themePhase: "BUILDING",
    compositeScore: 0.5,
    rs60: 0,
    flow20d: 0,
    volatility30d: 0.05,
    signalStreakDays: 0,
    alertCount30d: 0,
    confluenceScore: 50,
    persistenceScore: 50,
    investmentQualityScore: 50,
    ...overrides,
  } as ThemeDetail;
}

describe("comparators", () => {
  it("gives the win to the bigger number, and to whichever side actually has one", () => {
    expect(compareHigher(0.6, 0.4)).toBe("A");
    expect(compareHigher(0.4, 0.6)).toBe("B");
    expect(compareHigher(null, 0.4)).toBe("B");
    expect(compareHigher(0.4, null)).toBe("A");
    expect(compareHigher(null, null)).toBe("tie");
    expect(compareHigher(0.5, 0.5)).toBe("tie");
  });

  it("inverts that where less is better", () => {
    expect(compareLower(0.02, 0.09)).toBe("A");
    expect(compareLower(0.09, 0.02)).toBe("B");
    expect(compareLower(null, 0.09)).toBe("B");
  });

  it("calls a difference smaller than the tolerance a tie", () => {
    expect(compareHigher(0.500001, 0.5)).toBe("tie");
  });

  it("ranks positions on an ordered scale", () => {
    expect(compareOrdered(4, 1)).toBe("A");
    expect(compareOrdered(1, 4)).toBe("B");
    expect(compareOrdered(2, 2)).toBe("tie");
  });
});

describe("scoreDeltaOver5Days", () => {
  it("measures the move over the last five sessions, in points", () => {
    expect(scoreDeltaOver5Days(history([0.50, 0.51, 0.52, 0.53, 0.54, 0.60]))).toBe(10);
    expect(scoreDeltaOver5Days(history([0.60, 0.59, 0.58, 0.57, 0.56, 0.50]))).toBe(-10);
  });

  it("needs six sessions before it says anything", () => {
    expect(scoreDeltaOver5Days(history([0.5, 0.6, 0.7, 0.8, 0.9]))).toBeNull();
    expect(scoreDeltaOver5Days([])).toBeNull();
  });
});

describe("compareThemes", () => {
  it("counts a win per metric and knows which way each one points", () => {
    const strong = theme({
      dominantSignal: "BUY",
      themePhase: "BREAKOUT",
      compositeScore: 0.8,
      rs60: 0.05,
      flow20d: 1.2,
      volatility30d: 0.02, // less volatile — should win
      alertCount30d: 1, // fewer alerts — should win
      signalStreakDays: 12,
      confluenceScore: 80,
      persistenceScore: 80,
      investmentQualityScore: 80,
    });
    const weak = theme({
      dominantSignal: "REDUCE",
      themePhase: "WEAK",
      compositeScore: 0.3,
      rs60: -0.02,
      flow20d: -0.5,
      volatility30d: 0.09,
      alertCount30d: 9,
      signalStreakDays: 1,
      confluenceScore: 20,
      persistenceScore: 20,
      investmentQualityScore: 20,
    });

    const result = compareThemes(strong, weak, history([0.5, 0.5, 0.5, 0.5, 0.5, 0.8]), history([0.5, 0.5, 0.5, 0.5, 0.5, 0.3]));

    expect(result.metricCount).toBe(12);
    expect(result.winsA).toBe(12);
    expect(result.winsB).toBe(0);
    expect(result.winners.volatility).toBe("A");
    expect(result.winners.alerts).toBe("A");
    expect(result.scoreDeltaA).toBe(30);
    expect(result.scoreDeltaB).toBe(-20);
  });

  it("ties every metric when a theme is compared with itself", () => {
    const self = theme({});
    const result = compareThemes(self, self, history([]), history([]));

    expect(result.winsA).toBe(0);
    expect(result.winsB).toBe(0);
  });
});

import { ThemeDetail, ThemeHistoryPoint } from "@/lib/api";
import {
  buildPhaseTimeline,
  computeWatchGuidance,
  isCrowdedTrade,
  resolveHistoryDays,
} from "./themeDetail";

function hist(compositeScore: number, date = "2026-01-01"): ThemeHistoryPoint {
  return { date, compositeScore, trend5d: null, trend20d: null } as ThemeHistoryPoint;
}

function theme(overrides: Partial<ThemeDetail>): ThemeDetail {
  return {
    dominantSignal: "HOLD",
    compositeScore: 0.5,
    flow20d: 0,
    compositeTrend5d: null,
    compositeTrend20d: null,
    divergenceFromParentSectors: null,
    themePhase: null,
    ...overrides,
  } as ThemeDetail;
}

describe("resolveHistoryDays", () => {
  it("accepts the supported windows and defaults everything else to 30", () => {
    expect(resolveHistoryDays("90")).toBe(90);
    expect(resolveHistoryDays("180")).toBe(180);
    expect(resolveHistoryDays("45")).toBe(30);
    expect(resolveHistoryDays("abc")).toBe(30);
    expect(resolveHistoryDays(undefined)).toBe(30);
  });
});

describe("isCrowdedTrade", () => {
  const crowded = {
    dominantSignal: "BUY",
    compositeScore: 0.7,
    flow20d: 1.6,
    divergenceFromParentSectors: 0.1,
  };

  it("flags a theme only when signal, score, flow and divergence all agree", () => {
    expect(isCrowdedTrade(theme(crowded))).toBe(true);
    expect(isCrowdedTrade(theme({ ...crowded, dominantSignal: "WATCH" }))).toBe(false);
    expect(isCrowdedTrade(theme({ ...crowded, compositeScore: 0.6 }))).toBe(false);
    expect(isCrowdedTrade(theme({ ...crowded, flow20d: 1.4 }))).toBe(false);
    expect(isCrowdedTrade(theme({ ...crowded, divergenceFromParentSectors: 0.05 }))).toBe(false);
    expect(isCrowdedTrade(theme({ ...crowded, flow20d: null }))).toBe(false);
  });
});

describe("computeWatchGuidance", () => {
  it("needs both a score and a phase", () => {
    expect(computeWatchGuidance(theme({ themePhase: null }))).toBeNull();
    expect(computeWatchGuidance(theme({ compositeScore: null, themePhase: "BREAKOUT" }))).toBeNull();
    expect(computeWatchGuidance(theme({ themePhase: "UNKNOWN_PHASE" }))).toBeNull();
  });

  it("reports the flow a breakout must hold", () => {
    const guidance = computeWatchGuidance(
      theme({ themePhase: "BREAKOUT", compositeScore: 0.7, flow20d: 1.2 }),
    );
    expect(guidance).toContain("BREAKOUT");
    expect(guidance).toContain("1.2σ");
  });

  it("reports the distance to the BUY trigger while a theme is still building", () => {
    const guidance = computeWatchGuidance(theme({ themePhase: "BUILDING", compositeScore: 0.55 }));
    expect(guidance).toContain("10pt from BUY trigger");
  });

  it("falls back to a generic line when a building theme is already above the trigger", () => {
    const guidance = computeWatchGuidance(theme({ themePhase: "BUILDING", compositeScore: 0.8 }));
    expect(guidance).toContain("Building toward next level");
  });
});

describe("buildPhaseTimeline", () => {
  it("collapses backend phases into contiguous segments", () => {
    const history = [hist(0.5, "2026-01-01"), hist(0.6, "2026-01-02"), hist(0.7, "2026-01-03")];
    const timeline = buildPhaseTimeline(history, ["SETUP", "SETUP", "BREAKOUT"]);

    expect(timeline).not.toBeNull();
    expect(timeline!.totalDays).toBe(3);
    expect(timeline!.segments).toEqual([
      { phase: "SETUP", start: 0, end: 1, date: "2026-01-01" },
      { phase: "BREAKOUT", start: 2, end: 2, date: "2026-01-03" },
    ]);
  });

  it("derives phases from score history when the backend supplies none, after a 20-day warm-up", () => {
    const history = Array.from({ length: 25 }, (_, i) => hist(0.7, `2026-01-${i + 1}`));
    const timeline = buildPhaseTimeline(history);

    expect(timeline!.totalDays).toBe(5);
    expect(timeline!.segments[0].start).toBe(20);
    expect(timeline!.segments.every(s => s.phase !== "NEUTRAL")).toBe(true);
  });

  it("returns null when there is too little history to derive phases", () => {
    expect(buildPhaseTimeline(Array.from({ length: 21 }, () => hist(0.7)))).toBeNull();
    expect(buildPhaseTimeline([hist(0.7), hist(0.7)], ["MOMENTUM", "MOMENTUM"])).toBeNull();
  });
});

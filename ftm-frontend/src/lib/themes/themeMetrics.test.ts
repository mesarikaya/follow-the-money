import { ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import {
  getThemeUniqueSectors,
  phaseAgeDays,
  phaseFromHistory,
  scoreColor,
  scoreTier,
  signalAgeDays,
  themeShortLabel,
} from "./themeMetrics";

function hist(compositeScore: number, trend5d: number | null = null, trend20d: number | null = null): ThemeHistoryPoint {
  return { compositeScore, trend5d, trend20d } as ThemeHistoryPoint;
}

describe("scoreColor / scoreTier", () => {
  it("bands scores into the expected colour + tier", () => {
    expect(scoreColor(null)).toBe("text-slate-500");
    expect(scoreColor(0.7)).toBe("text-emerald-400");
    expect(scoreColor(0.55)).toBe("text-cyan-400");
    expect(scoreColor(0.4)).toBe("text-amber-400");
    expect(scoreColor(0.2)).toBe("text-red-400");

    expect(scoreTier(null)).toBe("HOLD");
    expect(scoreTier(0.7)).toBe("BUY");
    expect(scoreTier(0.55)).toBe("WATCH");
    expect(scoreTier(0.4)).toBe("HOLD");
    expect(scoreTier(0.2)).toBe("REDUCE");
  });
});

describe("signalAgeDays", () => {
  it("counts trailing days that held the dominant signal, stopping at the first break", () => {
    // trailing: BUY, BUY, WATCH(break) — from the end: 0.7, 0.7 are BUY, then 0.55 is WATCH
    const history = [hist(0.55), hist(0.7), hist(0.7)];
    expect(signalAgeDays(history, "BUY")).toBe(2);
  });

  it("returns 0 for empty history", () => {
    expect(signalAgeDays([], "BUY")).toBe(0);
  });
});

describe("phaseFromHistory", () => {
  it("returns NEUTRAL when trends are missing", () => {
    expect(phaseFromHistory(0.7, null, 0.01)).toBe("NEUTRAL");
  });

  it("classifies high-score phases by acceleration/trend", () => {
    expect(phaseFromHistory(0.7, 0.02, 0.01)).toBe("BREAKOUT"); // accelerating (0.02-0.01 > 0.005)
    expect(phaseFromHistory(0.7, 0.006, 0.005)).toBe("MOMENTUM"); // trending, not accelerating
    expect(phaseFromHistory(0.7, 0.0, 0.0)).toBe("HOLDING"); // neither
  });

  it("classifies mid-score setups and fading", () => {
    expect(phaseFromHistory(0.55, 0.02, 0.005)).toBe("SETUP");
    expect(phaseFromHistory(0.55, -0.01, -0.01)).toBe("FADING");
    expect(phaseFromHistory(0.55, 0.0, 0.0)).toBe("BUILDING");
  });

  it("marks low scores WEAK and mid-low NEUTRAL", () => {
    expect(phaseFromHistory(0.3, 0.0, 0.0)).toBe("WEAK");
    expect(phaseFromHistory(0.4, 0.0, 0.0)).toBe("NEUTRAL");
  });
});

describe("phaseAgeDays", () => {
  it("counts trailing days in the current phase", () => {
    // last two points are BREAKOUT (0.7 with accel), earlier is not
    const history = [hist(0.4, 0, 0), hist(0.7, 0.02, 0.01), hist(0.7, 0.02, 0.01)];
    expect(phaseAgeDays(history, "BREAKOUT")).toBe(2);
  });

  it("returns 0 when phase is null", () => {
    expect(phaseAgeDays([hist(0.7, 0.02, 0.01)], null)).toBe(0);
  });
});

describe("themeShortLabel", () => {
  it("uppercases the first 5 chars of a single-word name", () => {
    expect(themeShortLabel({ name: "Defense" } as ThemeSummary)).toBe("DEFEN");
  });

  it("takes first 4 chars of the first two words for multi-word names", () => {
    expect(themeShortLabel({ name: "Artificial Intelligence" } as ThemeSummary)).toBe("Arti Inte");
    expect(themeShortLabel({ name: "RATE_DURATION" } as ThemeSummary)).toBe("RATE DURA");
  });
});

describe("getThemeUniqueSectors", () => {
  it("returns up to three distinct parent sectors of the top constituents", () => {
    const theme = {
      topConstituents: [
        { categoryId: "SEMI", parentCategoryId: "TECH" },
        { categoryId: "SOFT", parentCategoryId: "TECH" },
        { categoryId: "FINL_BANK", parentCategoryId: "FINL" },
      ],
    } as unknown as ThemeSummary;
    const sectors = getThemeUniqueSectors(theme);
    // SEMI and SOFT both roll up to TECH → deduped; FINL_BANK → FINL
    expect(sectors).toContain("FINL");
    expect(new Set(sectors).size).toBe(sectors.length);
    expect(sectors.length).toBeLessThanOrEqual(3);
  });
});

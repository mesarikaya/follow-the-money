import { ThemeConstituent, ThemeHistoryPoint, ThemeSummary } from "@/lib/api";
import { getParentSectorId } from "@/lib/sectors";

/**
 * Pure theme domain helpers extracted from the themes page so they can be unit-tested and reused
 * independently of the many presentational components. All deterministic — no React, no formatting
 * of JSX; they map scores/history to tiers, phases, ages, and labels.
 */

/** Tailwind text colour for a composite score band (BUY→emerald … REDUCE→red). */
export function scoreColor(score: number | null): string {
  if (score == null) return "text-slate-500";
  if (score >= 0.65) return "text-emerald-400";
  if (score >= 0.5) return "text-cyan-400";
  if (score >= 0.35) return "text-amber-400";
  return "text-red-400";
}

/** Signal tier a composite score maps to: BUY / WATCH / HOLD / REDUCE. */
export function scoreTier(score: number | null): string {
  if (score == null) return "HOLD";
  if (score >= 0.65) return "BUY";
  if (score >= 0.5) return "WATCH";
  if (score >= 0.35) return "HOLD";
  return "REDUCE";
}

/** How many trailing days the score has continuously held the given signal tier. */
export function signalAgeDays(history: ThemeHistoryPoint[], dominantSignal: string): number {
  if (history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (scoreTier(history[i].compositeScore) === dominantSignal) count++;
    else break;
  }
  return count;
}

/**
 * The theme's lifecycle phase from its score and 5d/20d trends: BREAKOUT / MOMENTUM / HOLDING /
 * SETUP / BUILDING / FADING / WEAK / NEUTRAL.
 */
export function phaseFromHistory(score: number, trend5d: number | null, trend20d: number | null): string {
  if (trend5d == null || trend20d == null) return "NEUTRAL";
  const accelerating = trend5d - trend20d > 0.005;
  const trending = trend20d > 0.003;
  const fading = trend20d < -0.003;
  if (score >= 0.65) {
    if (accelerating) return "BREAKOUT";
    if (trending) return "MOMENTUM";
    return "HOLDING";
  }
  if (score >= 0.5) {
    if (accelerating) return "SETUP";
    if (fading) return "FADING";
    return "BUILDING";
  }
  if (fading) return "FADING";
  if (score < 0.35) return "WEAK";
  return "NEUTRAL";
}

/** How many trailing days the theme has continuously been in the given phase. */
export function phaseAgeDays(history: ThemeHistoryPoint[], currentPhase: string | null): number {
  if (!currentPhase || history.length === 0) return 0;
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (phaseFromHistory(h.compositeScore, h.trend5d, h.trend20d) === currentPhase) count++;
    else break;
  }
  return count;
}

/** Up to three distinct parent sectors represented by a theme's top constituents. */
export function getThemeUniqueSectors(theme: ThemeSummary): string[] {
  const seen = new Set<string>();
  for (const c of theme.topConstituents as ThemeConstituent[]) {
    const sectorId = getParentSectorId(c.categoryId) ?? (c.parentCategoryId ? getParentSectorId(c.parentCategoryId) : null);
    if (sectorId) seen.add(sectorId);
  }
  return [...seen].slice(0, 3);
}

/** A compact label for a theme (single word → 5 chars; else first two words → 4 chars each). */
export function themeShortLabel(theme: ThemeSummary): string {
  const words = theme.name.split(/[\s_]+/);
  if (words.length === 1) return theme.name.slice(0, 5).toUpperCase();
  return words.slice(0, 2).map(w => w.slice(0, 4)).join(" ");
}

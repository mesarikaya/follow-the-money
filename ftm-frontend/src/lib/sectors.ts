export const SECTOR_DRILLDOWN_IDS = new Set([
  "TECH", "HLTH", "FINL", "DISR", "INDU",
  "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM",
]);

export const SECTOR_SHORT_NAMES: Record<string, string> = {
  TECH: "Tech",
  HLTH: "Health",
  FINL: "Financials",
  DISR: "Discr.",
  INDU: "Industrials",
  ENRG: "Energy",
  MATL: "Materials",
  UTIL: "Utilities",
  REIT: "Real Est.",
  STPL: "Staples",
  COMM: "Comm.",
};

/** Legacy sub-sector IDs (V7, no prefix) → parent sector */
const LEGACY_SUBSECTOR_PARENT: Record<string, string> = {
  SEMI: "TECH",
  AIRO: "TECH",
  CLOD: "TECH",
  SOFT: "TECH",
};

/**
 * Derives the parent sector ID for any category.
 * - Top-level sectors return themselves.
 * - Prefixed sub-sectors (TECH_CYBR, FINL_BANK) → prefix.
 * - Legacy V7 TECH sub-sectors (SEMI, AIRO, CLOD, SOFT) → TECH via explicit map.
 * - Unknown categories return null.
 */
export function getParentSectorId(categoryId: string): string | null {
  if (SECTOR_DRILLDOWN_IDS.has(categoryId)) return categoryId;
  if (LEGACY_SUBSECTOR_PARENT[categoryId]) return LEGACY_SUBSECTOR_PARENT[categoryId];
  const prefix = categoryId.split("_")[0];
  if (SECTOR_DRILLDOWN_IDS.has(prefix)) return prefix;
  return null;
}

/** Category ID → primary ETF ticker (top-level parent categories) */
export const CATEGORY_ETF_MAP: Record<string, string> = {
  // GICS equity sectors
  TECH: "XLK",
  HLTH: "XLV",
  FINL: "XLF",
  DISR: "XLY",
  INDU: "XLI",
  ENRG: "XLE",
  MATL: "XLB",
  UTIL: "XLU",
  REIT: "XLRE",
  STPL: "XLP",
  COMM: "XLC",
  // Precious metals
  GOLD: "GLD",
  SLVR: "SLV",
  GDMN: "GDX",
  // Fixed income
  TLTD: "TLT",
  TINT: "IEF",
  CORP: "LQD",
  HIYLD: "HYG",
  // Cash
  CASH: "BIL",
  // Factor ETFs
  FTRS: "FTRS",
  MTUM: "MTUM",
  QUAL: "QUAL",
  USMV: "USMV",
  VLUE: "VLUE",
};

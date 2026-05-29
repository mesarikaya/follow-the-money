export const SECTOR_DRILLDOWN_IDS = new Set([
  "TECH", "HLTH", "FINL", "DISR", "INDU",
  "ENRG", "MATL", "UTIL", "REIT", "STPL", "COMM",
]);

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

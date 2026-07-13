import { get } from "./http";

/** Themes: their constituents, history, correlation, and how the portfolio covers them. */

export type ThemeConstituent = {
  categoryId: string;
  parentCategoryId: string | null;
  name: string;
  etfTicker: string;
  compositeScore: number | null;
  rs60: number | null;
  flow20d: number | null;
  compositeTrend5d: number | null;
  compositeTrend20d: number | null;
  tradeSignal: string | null;
  convictionScore: number | null;
};

export type ThemeSummary = {
  id: string;
  name: string;
  thesis: string;
  constituentCount: number;
  compositeScore: number | null;
  rs60: number | null;
  flow20d: number | null;
  compositeTrend5d: number | null;
  compositeTrend20d: number | null;
  bullishCount: number;
  dominantSignal: string;
  divergenceFromParentSectors: number | null;
  themePhase: string | null;
  topConstituents: ThemeConstituent[];
  alertCount30d: number;
  signalStreakDays: number;
  phaseStreakDays: number;
  volatility30d: number | null;
  scorePercentile30d: number | null;
  concentrationRisk: number | null;
  phaseTransitionSignal: string | null;
  riskLevel: string | null;
  entryAction: string | null;
  entryRationale: string | null;
  momentumAlignment: string | null;
  confluenceScore: number;
  confidenceLabel: string;
  persistenceScore: number;
  persistenceGrade: string;
  investmentQualityScore: number;
  investmentQualityGrade: string;
};

export type ThemeDetail = ThemeSummary & {
  constituents: ThemeConstituent[];
  phaseHistory30d: string[];
};

export type ThemeHistoryPoint = {
  date: string;
  compositeScore: number;
  trend5d: number | null;
  trend20d: number | null;
};

export type CapitalRotationData = {
  rotationScore: number;
  intensityLabel: string;
  scoreDispersion: number;
  trendAlignment: number;
  leadingThemeNames: string[];
  laggingThemeNames: string[];
};

export type ThemeCorrelationMatrix = {
  themeIds: string[];
  themeNames: string[];
  matrix: number[][];
};

export type ThemeSnapshot = {
  totalThemes: number;
  buyCount: number;
  watchCount: number;
  holdCount: number;
  reduceCount: number;
  breakoutCount: number;
  momentumCount: number;
  buildingCount: number;
  fadingCount: number;
  weakCount: number;
  averageCompositeScore: number;
  gainingMomentumCount: number;
  losingMomentumCount: number;
};

export type ThemePortfolioCoverage = {
  themeId: string;
  themeName: string;
  dominantSignal: string | null;
  themePhase: string | null;
  compositeScore: number;
  covered: boolean;
  coveringTickers: string[];
  portfolioExposurePct: number;
};

export const fetchThemes = () => get<ThemeSummary[]>("/api/v1/themes");

export const fetchTheme = (themeId: string) => get<ThemeDetail>(`/api/v1/themes/${themeId}`);

export const fetchThemeHistory = (themeId: string, days = 30) =>
  get<ThemeHistoryPoint[]>(`/api/v1/themes/${themeId}/history?days=${days}`);

export const fetchRotationScore = () => get<CapitalRotationData>("/api/v1/themes/rotation-score");

export const fetchThemeCorrelation = (days = 60) =>
  get<ThemeCorrelationMatrix>(`/api/v1/themes/signal-correlation?days=${days}`);

export const fetchThemeSnapshot = () => get<ThemeSnapshot>("/api/v1/themes/snapshot");

export const fetchThemePortfolioCoverage = () =>
  get<ThemePortfolioCoverage[]>("/api/v1/themes/portfolio-coverage");

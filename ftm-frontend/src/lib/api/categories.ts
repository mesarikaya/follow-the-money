import { get } from "./http";

/** Categories, sub-sectors, and everything the screener derives from them. */

export type CategorySummary = {
  id: string;
  name: string;
  type: string;
  etfTicker: string;
  compositeScore: number | null;
  compositeTrend5d: number | null;
  compositeTrend10d: number | null;
  compositeTrend20d: number | null;
  rrgQuadrant: string | null;
  rs60: number | null;
  rs120: number | null;
  rs20: number | null;
  flow20d: number | null;
  persistence5d: number | null;
  persistence20d: number | null;
  rank: number;
  latestClose: number | null;
  priceDate: string | null;
  tradeSignal: string | null;
  macroFit: number | null;
  momentum: number | null;
  signalDaysActive: number | null;
  realizedVol20d: number | null;
  scorePercentile252d: number | null;
  convictionScore: number | null;
  activeAlertCount: number | null;
  parentId: string | null;
  scoreStreakDays: number | null;
};

export type CategoriesResponse = {
  asOfDate: string;
  timeframe: string;
  categories: CategorySummary[];
};

export type SubSectorSummary = {
  id: string;
  name: string;
  parentId: string;
  etfTicker: string;
  rs20: number | null;
  rs60: number | null;
  rs120: number | null;
  momentum: number | null;
  rrgQuadrant: string | null;
  compositeScore: number | null;
  compositeTrend5d: number | null;
  compositeTrend20d: number | null;
  tradeSignal: string | null;
  persistence5d: number | null;
  persistence20d: number | null;
  macroFit: number | null;
  convictionScore: number | null;
  signalDaysActive: number | null;
  scorePercentile252d: number | null;
};

export type SignalWinRateDto = {
  categoryId: string;
  signalCount: number;
  winRate: number | null;
  avgReturn30d: number | null;
  avgReturn90d: number | null;
};

export type PriceLevelDto = {
  categoryId: string;
  currentPrice: number | null;
  high52w: number | null;
  low52w: number | null;
  drawdownFromHigh: number | null;
  positionInRange: number | null;
  daysOfData: number;
};

export type SignalTransitionDto = {
  categoryId: string;
  categoryName: string;
  etfTicker: string;
  previousSignal: string | null;
  currentSignal: string;
  currentScore: number;
  comparisonDate: string;
  daysAgo: number;
  scorePercentile252d: number | null;
  macroFit: number | null;
  signalDaysActive: number | null;
  convictionScore: number | null;
};

export type ScoreDecompositionDto = {
  categoryId: string;
  relativeStrength60Contribution: number | null;
  relativeStrength120Contribution: number | null;
  persistence20dContribution: number | null;
  flow20dContribution: number | null;
  momentumContribution: number | null;
  macroFitContribution: number | null;
  rrgContribution: number | null;
  totalScore: number | null;
};

export type ScreenerSnapshotDto = {
  buyCount: number;
  watchCount: number;
  holdCount: number;
  reduceCount: number;
  totalCategories: number;
  avgCompositeScore: number;
  rsBreadthPct: number;
  momentumBreadthPct: number;
  riskOnPct: number;
};

export type SeasonalReturn = {
  categoryId: string;
  month: number;
  avgReturn: number;
  sampleCount: number;
};

export type ApproachingSignalDto = {
  categoryId: string;
  categoryName: string;
  etfTicker: string;
  currentSignal: string;
  projectedSignal: string;
  estimatedDays: number;
  currentScore: number;
  scoreGapToThreshold: number;
  dailyVelocity: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
};

export const fetchCategories = (timeframe = "MONTH") =>
  get<CategoriesResponse>(`/api/v1/categories?timeframe=${timeframe}`);

export const fetchCategoryScoreHistory = (days = 30) =>
  get<Record<string, number[]>>(`/api/v1/categories/score-history?days=${days}`);

export const fetchSubSectors = (parent = "TECH") =>
  get<SubSectorSummary[]>(`/api/v1/sub-sectors?parent=${parent}`);

export const fetchWinRates = (lookbackDays = 365) =>
  get<SignalWinRateDto[]>(`/api/v1/categories/win-rates?lookbackDays=${lookbackDays}`);

export const fetchPriceLevels = () => get<PriceLevelDto[]>("/api/v1/categories/price-levels");

export const fetchSignalTransitions = (days = 7) =>
  get<SignalTransitionDto[]>(`/api/v1/categories/transitions?days=${days}`);

export const fetchScoreComponents = () =>
  get<Record<string, ScoreDecompositionDto>>("/api/v1/categories/score-components");

export const fetchScreenerSnapshot = () =>
  get<ScreenerSnapshotDto>("/api/v1/categories/screener-snapshot");

export const fetchSeasonalReturns = () => get<SeasonalReturn[]>("/api/v1/categories/seasonal");

export const fetchApproachingSignals = (timeframe = "60d") =>
  get<ApproachingSignalDto[]>(`/api/v1/categories/approaching?timeframe=${timeframe}`);

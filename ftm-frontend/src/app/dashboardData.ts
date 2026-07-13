import {
  ApproachingSignalDto,
  CategoriesResponse,
  CategorySummary,
  HoldingActionDto,
  MacroResponse,
  PriceLevelDto,
  RotationResponse,
  ScoreDecompositionDto,
  SignalTransitionDto,
  SignalWinRateDto,
  SubSectorSummary,
  ThemeHistoryPoint,
  ThemeSnapshot,
  ThemeSummary,
  fetchApproachingSignals,
  fetchCategories,
  fetchCategoryScoreHistory,
  fetchMacro,
  fetchPortfolioActions,
  fetchPriceLevels,
  fetchRotation,
  fetchScoreComponents,
  fetchSignalTransitions,
  fetchSubSectors,
  fetchThemeHistory,
  fetchThemeSnapshot,
  fetchThemes,
  fetchWinRates,
} from "@/lib/api";
import { SECTOR_DRILLDOWN_IDS } from "@/lib/sectors";

/**
 * Loads everything the dashboard shows. Every panel is optional — a failed fetch leaves its panel
 * empty rather than taking the page down, which is why each result is settled independently.
 */

const SCORE_HISTORY_DAYS = 30;
const THEME_HISTORY_DAYS = 30;
const WIN_RATE_LOOKBACK_DAYS = 365;
const TRANSITION_LOOKBACK_DAYS = 7;

const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === "fulfilled" ? result.value : fallback;

/** The reason a fetch failed, for the two panels that tell the user rather than falling silent. */
const reasonOf = (result: PromiseSettledResult<unknown>): string | null =>
  result.status === "rejected" ? String(result.reason) : null;

const byId = <T,>(items: T[], idOf: (item: T) => string): Record<string, T> => {
  const map: Record<string, T> = {};
  items.forEach(item => {
    map[idOf(item)] = item;
  });
  return map;
};

export type DashboardData = {
  categories: CategorySummary[];
  asOfDate: string | null;
  macro: MacroResponse | null;
  rotation: RotationResponse | null;
  scoreHistory: Record<string, number[]>;
  scoreComponentsByCategory: Record<string, ScoreDecompositionDto>;
  winRateByCategory: Record<string, SignalWinRateDto>;
  priceLevelByCategory: Record<string, PriceLevelDto>;
  signalTransitions: SignalTransitionDto[];
  approachingSignals: ApproachingSignalDto[];
  portfolioActions: HoldingActionDto[];
  themes: ThemeSummary[];
  themeSnapshot: ThemeSnapshot | null;
  historiesByThemeId: Record<string, ThemeHistoryPoint[]>;
  topSubSectorByParent: Record<string, SubSectorSummary>;
  allSubSectorsByParent: Record<string, SubSectorSummary[]>;
  categoriesError: string | null;
  macroError: string | null;
};

/** Each sector's sub-sectors, strongest first — the dashboard shows the leader of each. */
const collectSubSectors = (
  sectorIds: string[],
  results: PromiseSettledResult<SubSectorSummary[]>[],
) => {
  const topSubSectorByParent: Record<string, SubSectorSummary> = {};
  const allSubSectorsByParent: Record<string, SubSectorSummary[]> = {};

  results.forEach((result, index) => {
    const subSectors = valueOr(result, []);
    if (subSectors.length === 0) return;
    const ranked = [...subSectors].sort((a, b) => (b.rs60 ?? -Infinity) - (a.rs60 ?? -Infinity));
    topSubSectorByParent[sectorIds[index]] = ranked[0];
    allSubSectorsByParent[sectorIds[index]] = ranked;
  });

  return { topSubSectorByParent, allSubSectorsByParent };
};

/** A theme's own history is fetched per theme, so it can only start once the themes are known. */
const loadThemeHistories = async (
  themes: ThemeSummary[],
): Promise<Record<string, ThemeHistoryPoint[]>> => {
  const results = await Promise.allSettled(
    themes.map(theme => fetchThemeHistory(theme.id, THEME_HISTORY_DAYS)),
  );
  const historiesByThemeId: Record<string, ThemeHistoryPoint[]> = {};
  themes.forEach((theme, index) => {
    historiesByThemeId[theme.id] = valueOr(results[index], []);
  });
  return historiesByThemeId;
};

export const loadDashboard = async (timeframe: string): Promise<DashboardData> => {
  const sectorIds = Array.from(SECTOR_DRILLDOWN_IDS);

  const [
    categoriesResult,
    macroResult,
    rotationResult,
    scoreHistoryResult,
    winRatesResult,
    priceLevelsResult,
    transitionsResult,
    scoreComponentsResult,
    approachingSignalsResult,
    portfolioActionsResult,
    themesResult,
    snapshotResult,
    ...subSectorResults
  ] = await Promise.allSettled([
    fetchCategories(timeframe),
    fetchMacro(),
    fetchRotation(),
    fetchCategoryScoreHistory(SCORE_HISTORY_DAYS),
    fetchWinRates(WIN_RATE_LOOKBACK_DAYS),
    fetchPriceLevels(),
    fetchSignalTransitions(TRANSITION_LOOKBACK_DAYS),
    fetchScoreComponents(),
    fetchApproachingSignals(),
    fetchPortfolioActions(),
    fetchThemes(),
    fetchThemeSnapshot(),
    ...sectorIds.map(id => fetchSubSectors(id)),
  ]);

  const categoriesResponse = valueOr<CategoriesResponse | null>(categoriesResult, null);
  const themes = valueOr(themesResult, [] as ThemeSummary[]);

  return {
    categories: categoriesResponse?.categories ?? [],
    asOfDate: categoriesResponse?.asOfDate ?? null,
    macro: valueOr(macroResult, null as MacroResponse | null),
    rotation: valueOr(rotationResult, null as RotationResponse | null),
    scoreHistory: valueOr(scoreHistoryResult, {} as Record<string, number[]>),
    scoreComponentsByCategory: valueOr(
      scoreComponentsResult,
      {} as Record<string, ScoreDecompositionDto>,
    ),
    winRateByCategory: byId(valueOr(winRatesResult, []), winRate => winRate.categoryId),
    priceLevelByCategory: byId(valueOr(priceLevelsResult, []), level => level.categoryId),
    signalTransitions: valueOr(transitionsResult, [] as SignalTransitionDto[]),
    approachingSignals: valueOr(approachingSignalsResult, [] as ApproachingSignalDto[]),
    portfolioActions: valueOr(portfolioActionsResult, [] as HoldingActionDto[]),
    themes,
    themeSnapshot: valueOr(snapshotResult, null as ThemeSnapshot | null),
    historiesByThemeId: await loadThemeHistories(themes),
    ...collectSubSectors(sectorIds, subSectorResults),
    categoriesError: reasonOf(categoriesResult),
    macroError: reasonOf(macroResult),
  };
};

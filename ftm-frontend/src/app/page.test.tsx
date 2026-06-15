import { render, screen } from "@testing-library/react";
import { act } from "react";
import Home from "./page";

jest.mock("@/lib/api", () => ({
  fetchCategories: jest.fn().mockResolvedValue({
    asOfDate: "2026-05-16",
    timeframe: "MONTH",
    categories: [],
  }),
  fetchMacro: jest.fn().mockResolvedValue({
    asOfDate: "2026-05-16",
    regime: "RISK_ON_GROWTH",
    indicators: {
      vix: 15.2,
      tenYearYield: 4.5,
      twoYearYield: 4.8,
      yieldSpread10y2y: -0.3,
      breakevenInflation: 2.3,
      fedFundsRate: 5.25,
      usdIndex: 104.5,
    },
    previousIndicators: null,
    regimeHistory: [],
    macroFitByCategory: null,
  }),
  fetchRotation: jest.fn().mockResolvedValue({
    asOfDate: "2026-05-16",
    topLeaders: [],
    bottomLaggards: [],
    recentEvents: [],
  }),
  fetchCategoryScoreHistory: jest.fn().mockResolvedValue({}),
  fetchSubSectors: jest.fn().mockResolvedValue([]),
  fetchWinRates: jest.fn().mockResolvedValue([]),
  fetchPriceLevels: jest.fn().mockResolvedValue([]),
  fetchSignalTransitions: jest.fn().mockResolvedValue([]),
  fetchThemes: jest.fn().mockResolvedValue([]),
  fetchThemeHistory: jest.fn().mockResolvedValue([]),
  fetchScoreComponents: jest.fn().mockResolvedValue({}),
  fetchApproachingSignals: jest.fn().mockResolvedValue([]),
  fetchPortfolioActions: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/components/ScreenerSnapshotBanner", () => {
  return function MockScreenerSnapshotBanner() {
    return null;
  };
});

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  usePathname: jest.fn(() => "/"),
  useSearchParams: jest.fn(() => ({ toString: () => "" })),
}));

const defaultProps = {
  searchParams: Promise.resolve({ timeframe: "MONTH" }),
};

test("home page renders category and macro sections", async () => {
  await act(async () => {
    render(await Home(defaultProps));
  });
  expect(screen.getByText("Rotation Signals")).toBeInTheDocument();
  expect(screen.getByText("Macro Environment")).toBeInTheDocument();
  expect(screen.getByText(/Categories/)).toBeInTheDocument();
});

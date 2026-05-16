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
    indicators: {},
    regimeHistory: [],
  }),
}));

test("home page renders API debug sections", async () => {
  await act(async () => {
    render(await Home());
  });
  expect(screen.getByText(/\/categories/)).toBeInTheDocument();
  expect(screen.getByText(/\/macro/)).toBeInTheDocument();
});

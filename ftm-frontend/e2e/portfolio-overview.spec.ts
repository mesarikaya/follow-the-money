import { test, expect } from "@playwright/test";

/**
 * Verifies the "Actions + alignment first" overview header renders against the real app
 * (playwright.real.config.ts, baseURL :3000): total value, alignment, invested/cash split, and the
 * "Do Now" rebalance actions.
 */
test("portfolio overview header renders alignment, split and Do Now", async ({ page }) => {
  await page.goto("/portfolio", { waitUntil: "networkidle" });

  const overview = page.getByTestId("portfolio-overview");
  await expect(overview).toBeVisible();
  await expect(overview).toContainText("Total Value");
  await expect(overview).toContainText("Alignment");
  await expect(overview).toContainText("Invested");
  await expect(overview).toContainText("Cash");
  await expect(overview).toContainText("Do Now");

  // Either concrete actions or the aligned-empty state — both are valid, neither is an error.
  const hasActions = (await page.getByTestId("do-now-actions").count()) > 0;
  const alignedMessage = overview.getByText("no rebalance needed", { exact: false });
  expect(hasActions || (await alignedMessage.count()) > 0).toBeTruthy();
});

test("heavy detail sections are collapsed by default and expand on click", async ({ page }) => {
  await page.goto("/portfolio", { waitUntil: "networkidle" });

  const allocations = page.getByTestId("collapsible-allocations-rebalancing");
  const sector = page.getByTestId("collapsible-sector-exposure-vs-target");

  await expect(allocations).toBeVisible();
  await expect(allocations).toHaveAttribute("aria-expanded", "false");
  await expect(sector).toBeVisible();

  // Collapsed: the allocation editor's "Allocation Overview" heading is not rendered yet.
  await expect(page.getByText("Allocation Overview")).toHaveCount(0);

  await allocations.click();
  await expect(allocations).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Allocation Overview")).toBeVisible();
});

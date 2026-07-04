import { defineConfig, devices } from "@playwright/test";

// Linux-compatible Playwright config for CI (GitHub Actions).
// webServer commands use plain `node` and relative bin paths instead of
// the Windows-specific .cmd wrappers used in playwright.config.ts.
export default defineConfig({
  testDir: "./e2e",
  // These smoke specs assert against the real backend + a production frontend build
  // (playwright.real.config.ts); they are not meant to run against the mock backend here.
  testIgnore: ["**/page-health.spec.ts", "**/portfolio-overview.spec.ts", "**/backtest-equal-weight.spec.ts"],
  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "node e2e/mock-backend.mjs",
      url: "http://127.0.0.1:9999/api/v1/categories",
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "node_modules/.bin/next dev --port 3001",
      url: "http://localhost:3001",
      reuseExistingServer: false,
      env: { BACKEND_URL: "http://127.0.0.1:9999", NEXT_PUBLIC_BACKEND_URL: "http://127.0.0.1:9999" },
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

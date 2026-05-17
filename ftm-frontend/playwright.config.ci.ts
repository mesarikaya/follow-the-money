import { defineConfig, devices } from "@playwright/test";

// Linux-compatible Playwright config for CI (GitHub Actions).
// webServer commands use plain `node` and relative bin paths instead of
// the Windows-specific .cmd wrappers used in playwright.config.ts.
export default defineConfig({
  testDir: "./e2e",
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
      env: { BACKEND_URL: "http://127.0.0.1:9999" },
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

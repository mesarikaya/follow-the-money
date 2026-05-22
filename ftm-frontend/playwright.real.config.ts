import { defineConfig, devices } from "@playwright/test";

/**
 * Runs E2E tests against locally-running services — no mocks.
 *
 * Before running, start both services in separate terminals:
 *   1. Spring Boot:  cd ftm-app && ./mvnw spring-boot:run
 *   2. Next.js:      cd ftm-frontend && pnpm dev          (defaults BACKEND_URL=http://localhost:8080)
 *
 * Then run:  pnpm test:e2e:real
 *
 * Note: tests that assert specific fixture counts (e.g. "3 entries") were
 * written for the mock backend and will fail here — that's expected. Use
 * --grep to run only smoke-level checks (e.g. pnpm test:e2e:real --grep "loads").
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer block — assumes both services are already running.
});

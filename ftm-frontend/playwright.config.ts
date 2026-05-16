import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
  webServer: [
    {
      // Mock backend replaces Spring Boot during E2E tests.
      // Uses "pnpm run mock-backend" so pnpm provides its bundled Node.js.
      command: "cmd /c e2e\\run-mock.cmd",
      url: "http://127.0.0.1:9999/api/v1/categories",
      reuseExistingServer: !process.env.CI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Next.js dev server pointed at the mock backend via BACKEND_URL.
      // Uses "pnpm run dev:e2e" so pnpm resolves node via the explicit full
      // path baked into the script (nvm node is not in the system PATH).
      command: "cmd /c e2e\\run-next.cmd",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      env: { BACKEND_URL: "http://127.0.0.1:9999" },
      timeout: 60000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});

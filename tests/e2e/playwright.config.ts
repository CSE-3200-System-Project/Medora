import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const shouldStartServer = process.env.E2E_START_SERVER === "1";

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: "../../tests/benchmarks/reports/current/playwright-html" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-en",
      use: {
        ...devices["Desktop Chrome"],
        locale: "en-US",
      },
    },
    {
      name: "chromium-bn",
      use: {
        ...devices["Desktop Chrome"],
        locale: "bn-BD",
      },
    },
  ],
  webServer: shouldStartServer
    ? {
        command: "npm run dev",
        cwd: "../../frontend",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});

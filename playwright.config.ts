import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Local runs use the shared remote-backed development database; allow route
  // revalidation to settle without weakening individual UI assertions.
  timeout: 90_000,
  // The shared hosted dev database occasionally stalls queries for tens of
  // seconds; the default 5s would turn those windows into false failures.
  expect: { timeout: 25_000 },
  fullyParallel: false,
  workers: 1,
  // One retry absorbs single transient blips from the shared hosted dev
  // database (cold starts / momentary connection refusals). Every retry is
  // still reported and traced, so flakiness stays visible rather than hidden.
  retries: 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

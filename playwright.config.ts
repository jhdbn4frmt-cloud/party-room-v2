import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 90000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.PARTY_TEST_URL ?? "http://127.0.0.1:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

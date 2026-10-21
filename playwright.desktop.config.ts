import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "desktop-tests",
  timeout: 90000,
  workers: 1,
  outputDir: "desktop-test-results",
  use: { headless: true },
});

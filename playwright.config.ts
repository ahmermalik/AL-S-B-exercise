import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export default defineConfig({
  testDir: "./tests", fullyParallel: false, workers: 1, timeout: 60_000,
  use: { baseURL: "http://127.0.0.1:3101", headless: true, viewport: { width: 1440, height: 1000 }, launchOptions: existsSync(chrome) ? { executablePath: chrome } : {}, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: process.env.PLAYWRIGHT_USE_RUNNING_SERVER === "1" ? undefined : {
    command: "node --env-file-if-exists=.env.local --import tsx scripts/e2e-server.ts", url: "http://127.0.0.1:3101/login", reuseExistingServer: false, timeout: 120_000,
    env: { PORT: "3101", BETTER_AUTH_URL: "http://127.0.0.1:3101", DATABASE_PATH: "data/e2e/workspace.sqlite", LOCAL_SEED_PASSWORD: "CloseReview!2026", OPENAI_API_KEY: "", OPENAI_MODEL: "" },
  },
});

import { defineConfig, devices } from "@playwright/test";

// Сценарии для статической сборки (GitHub Pages). Перед запуском: npm run build:pages
// с адресами заглушки каталога в NEXT_PUBLIC_*_BASE_URL — см. .github/workflows/pages.yml.
const PORT = 3200;
const MOCK_PORT = Number(process.env.MOCK_CATALOG_PORT ?? 3101);
const executablePath = process.env.PW_CHROME_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e-static",
  outputDir: "./test-results/static",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "ru-RU",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  webServer: [
    {
      command: "node tests/e2e/mock-catalog.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/__health`,
      env: { MOCK_CATALOG_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node tests/e2e-static/serve.mjs",
      url: `http://127.0.0.1:${PORT}/AI-Book-Intelligence/`,
      env: { PORT: String(PORT) },
      reuseExistingServer: !process.env.CI,
    },
  ],
});

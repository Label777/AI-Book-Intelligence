import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const MOCK_PORT = Number(process.env.MOCK_CATALOG_PORT ?? 3101);
const MOCK_CATALOG = `http://127.0.0.1:${MOCK_PORT}`;

// Локально можно указать уже установленный браузер:
// PW_CHROME_PATH=/usr/bin/google-chrome npm run test:e2e
const executablePath = process.env.PW_CHROME_PATH || undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    locale: "ru-RU",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions: { executablePath } },
    },
  ],
  // Приложение в тестах ходит не в настоящий каталог, а в локальную заглушку с записанными ответами.
  webServer: [
    {
      command: "node tests/e2e/mock-catalog.mjs",
      url: `${MOCK_CATALOG}/__health`,
      env: { MOCK_CATALOG_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      command: `node tests/e2e/prepare-store.mjs && npm run start -- --port ${PORT}`,
      url: baseURL,
      env: {
        OPEN_LIBRARY_BASE_URL: MOCK_CATALOG,
        GOOGLE_BOOKS_BASE_URL: MOCK_CATALOG,
        WIKIDATA_BASE_URL: MOCK_CATALOG,
        // Готовые анализы для тестов; ключа модели нет — запуск новых недоступен.
        ANALYSIS_STORE_DIR: ".e2e-store",
        ANTHROPIC_API_KEY: "",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});

import { defineConfig, devices } from "@playwright/test";

// Проверка выложенного сайта (tests/live). Нужен доступ в интернет.
export default defineConfig({
  testDir: "./tests/live",
  outputDir: "./test-results/live",
  retries: 1,
  reporter: "list",
  use: { locale: "ru-RU" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: process.env.PW_CHROME_PATH || undefined },
      },
    },
  ],
});

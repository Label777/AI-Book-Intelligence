import { writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Проверка выложенного сайта: настоящий браузер, настоящие каталоги и библиотеки.
// Запускается после публикации (.github/workflows/pages.yml); итог — в live-check.json.
const SITE =
  process.env.LIVE_SITE_URL ?? "https://label777.github.io/AI-Book-Intelligence";

test("поиск и библиотеки работают на выложенном сайте", async ({ page }) => {
  test.setTimeout(120_000);
  const report: Record<string, unknown> = { site: SITE };
  const failed: string[] = [];
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    if (!url.hostname.includes("github.io")) {
      failed.push(`${url.hostname}${url.pathname} — ${request.failure()?.errorText}`);
    }
  });

  // Ответы библиотек: статус и разрешение на запросы с других сайтов.
  const responses: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (/gutendex|googleapis|wikidata/.test(url.hostname)) {
      const cors = response.headers()["access-control-allow-origin"] ?? "нет";
      responses.push(
        `${url.hostname}${url.pathname} → ${response.status()}, CORS: ${cors}`,
      );
    }
  });

  try {
    await page.goto(`${SITE}/`);
    report.home = await page.getByRole("heading", { level: 1 }).innerText();

    await page.getByRole("searchbox").fill("Pride and Prejudice Jane Austen");
    await page.getByRole("searchbox").press("Enter");
    const firstCard = page.locator("main a[href*='/book']").first();
    await expect(firstCard).toBeVisible({ timeout: 45_000 });
    report.searchStatus = await page.locator("main [role=status] p").first().innerText();
    report.searchTitles = await page.locator("main h2, main h3").allInnerTexts();

    await firstCard.click();
    await expect(page.getByText("Это та книга?")).toBeVisible({ timeout: 45_000 });
    report.bookTitle = await page.getByRole("heading", { level: 1 }).last().innerText();
    report.bookMeta = await page
      .locator("main .text-label.text-ink-2")
      .first()
      .innerText();

    const libraries = page.getByRole("region", { name: "Где читать и слушать" });
    await expect(libraries.getByText("Проверяем наличие в библиотеках…")).toBeHidden({
      timeout: 60_000,
    });
    report.found = await libraries
      .locator("[data-found]")
      .evaluateAll((links) =>
        links.map(
          (link) =>
            `${link.getAttribute("data-found")}: ${(link as HTMLAnchorElement).href}`,
        ),
      );
    report.searchLinks = await libraries.locator("[data-library]").count();
    report.coverLoaded = await page
      .locator("main img")
      .first()
      .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 1)
      .catch(() => false);
  } catch (error) {
    report.error = error instanceof Error ? error.message.slice(0, 600) : String(error);
  }
  report.failedRequests = failed.slice(0, 10);
  report.responses = responses.slice(0, 10);
  writeFileSync("live-check.json", JSON.stringify(report, null, 2));
  expect(report.error).toBeUndefined();
});

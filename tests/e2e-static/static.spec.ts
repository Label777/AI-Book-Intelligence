import { expect, test } from "@playwright/test";

// Проверка статической сборки (GitHub Pages): сайт без сервера, под базовым путём.
const BASE = process.env.PAGES_BASE_PATH ?? "/AI-Book-Intelligence";

test.beforeEach(async ({ page }) => {
  await page.route("https://covers.openlibrary.org/**", (route) => route.abort());
});

test("главная, поиск, страница книги и выбор издания работают без сервера", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${BASE}/`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Не пересказ книги",
  );

  await page.getByRole("searchbox").fill("sapiens harari");
  await page.getByRole("button", { name: "Создать анализ" }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/search/?\\?q=sapiens\\+harari$`));
  await expect(page.getByText("Скорее всего, вы ищете эту книгу.")).toBeVisible();

  await page.getByRole("link", { name: "Да, это она" }).click();
  await expect(page).toHaveURL(
    new RegExp(`${BASE}/book/?\\?id=OL17075811W&q=sapiens\\+harari$`),
  );
  await expect(page.getByRole("heading", { level: 1, name: "Sapiens" })).toBeVisible();
  await expect(page.getByText("Первая публикация: 2011 · 86 изданий")).toBeVisible();

  // Наличие в библиотеках браузер проверяет сам.
  const libraries = page.getByRole("region", { name: "Где читать и слушать" });
  await expect(libraries.locator("[data-found]")).toHaveCount(2);
  await expect(libraries.locator("[data-library]")).toHaveCount(8);

  await page.getByRole("link", { name: "русский", exact: true }).click();
  await page.getByRole("link", { name: /Краткая история человечества/ }).click();
  await expect(page).toHaveURL(
    /id=OL17075811W&q=sapiens\+harari&lang=rus&edition=OL40000005M$/,
  );
  await expect(
    page.getByRole("heading", { name: /Выбрано издание: Sapiens\. Краткая/ }),
  ).toBeVisible();
  await expect(page.getByText("Создание анализа здесь недоступно")).toBeVisible();
  await expect(page.getByRole("button", { name: "Создать анализ" })).toHaveCount(0);

  // Страница открывается и по прямой ссылке, и после перезагрузки.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Sapiens" })).toBeVisible();

  await page.getByRole("link", { name: "← Не та книга? Все результаты" }).click();
  await expect(
    page.getByRole("heading", { name: "Sapiens: A Graphic History" }),
  ).toBeVisible();

  // Шапка и тема.
  await page.getByRole("link", { name: "AI Book Intelligence" }).click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/$`));
  await page.getByRole("button", { name: "Включить светлую тему" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);
});

test("пустой результат, опечатка, перевод названия и неизвестная книга", async ({
  page,
}) => {
  await page.goto(`${BASE}/search/?q=zzzzqqq`);
  await expect(page.getByText("По запросу «zzzzqqq» ничего не найдено")).toBeVisible();

  await page.goto(`${BASE}/search/?q=sapeins+harari`);
  await expect(page.getByText("Показаны книги с похожими названиями.")).toBeVisible();

  await page.goto(`${BASE}/search/?q=${encodeURIComponent("Атомные привычки")}`);
  await expect(page.getByText("«Atomic Habits James Clear»")).toBeVisible();

  await page.goto(`${BASE}/search/?q=catalogdown`);
  await expect(page.getByText("Каталог книг сейчас не отвечает")).toBeVisible();

  await page.goto(`${BASE}/book/?id=OL999W`);
  await expect(page.getByRole("heading", { name: "Книга не найдена" })).toBeVisible();
  await page.goto(`${BASE}/book/`);
  await expect(page.getByRole("heading", { name: "Книга не найдена" })).toBeVisible();

  const response = await page.goto(`${BASE}/no-such-page/`);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
});

test("на телефоне нет горизонтальной прокрутки", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const path of ["/", "/search/?q=the+gift", "/book/?id=OL17075811W"]) {
    await page.goto(`${BASE}${path}`);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("готовый анализ книги открывается без сервера: слайды, источники, путь к книге", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto(`${BASE}/`);
  await page
    .locator("#examples")
    .getByRole("link", { name: /Лидерство/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`${BASE}/library/kissinger-leadership/?$`));
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "Лидерство. Шесть этюдов о мировой стратегии",
    }),
  ).toBeVisible();

  await page.keyboard.press("End");
  await expect(
    page.getByRole("heading", { level: 2, name: "AI-аналитика" }),
  ).toBeVisible();
  await expect(
    page.getByText("Оценки — мнение AI с объяснением, а не научный рейтинг."),
  ).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Слайды" });
  await nav.getByRole("link", { name: /Разбор по главам/ }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Разбор по главам" }),
  ).toBeVisible();
  await expect(page.getByText("6. Маргарет Тэтчер")).toBeVisible();

  await page
    .getByRole("button", { name: /Факт из книги.*открыть источник/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByText("Сверено с источником при подготовке анализа."),
  ).toBeVisible();
  await expect(
    dialog.getByText("Что сказано в источнике (пересказ)").first(),
  ).toBeVisible();
  await expect(dialog.locator("blockquote")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: /К книге/ }).click();
  await expect(page).toHaveURL(
    new RegExp(`${BASE}/search/?\\?q=Leadership\\+Henry\\+Kissinger$`),
  );
  expect(errors).toEqual([]);
});

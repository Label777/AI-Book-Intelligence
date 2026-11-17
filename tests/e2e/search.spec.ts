import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, MOCK_CATALOG, stubCovers } from "./helpers";

test.beforeEach(async ({ page }) => {
  await stubCovers(page);
});

const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test("одноимённые книги: показываем список, а не угадываем", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("The Gift");
  await page.getByRole("button", { name: "Создать анализ" }).click();

  await expect(page).toHaveURL(/\/search\?q=The\+Gift$/);
  await expect(page.getByText("Найдены 3 книги по запросу «The Gift»")).toBeVisible();
  const cards = page
    .getByRole("listitem")
    .filter({ has: page.getByRole("heading", { name: "The Gift" }) });
  await expect(cards).toHaveCount(3);
  await expect(page.getByText("Marcel Mauss").first()).toBeVisible();
  await expect(page.getByText("1925 · 55 изданий")).toBeVisible();
  await expect(cards.first().getByRole("link")).toHaveAttribute(
    "href",
    /^\/book\/OL\d+W\?q=The\+Gift$/,
  );
});

test("уверенное совпадение выделено, один клик до подтверждения книги", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("sapiens harari");
  await page.getByRole("searchbox").press("Enter");

  await expect(page).toHaveURL(/\/search\?q=sapiens\+harari$/);
  await expect(page.getByText("Скорее всего, вы ищете эту книгу.")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Sapiens", exact: true }),
  ).toBeVisible();
  // Дубль записи объединён, пересказ — в конце списка.
  const others = await page.getByRole("heading", { level: 3 }).allTextContents();
  expect(others).toEqual([
    "Sapiens: A Graphic History",
    "Summary of Sapiens by Yuval Noah Harari",
  ]);

  await page.getByRole("link", { name: "Да, это она" }).click();
  await expect(page).toHaveURL(/\/book\/OL17075811W\?q=sapiens\+harari$/);
  await expect(page.getByText("Это та книга?")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Sapiens" })).toBeVisible();
  await expect(page.getByText("Yuval Noah Harari").filter({ visible: true })).toHaveCount(
    1,
  );
  await expect(page.getByText("Первая публикация: 2011 · 86 изданий")).toBeVisible();
  await expect(page.getByText("Описание из каталога Open Library")).toBeVisible();
  await expect(page.getByText("Показаны 5 из 86 изданий.")).toBeVisible();

  await page.getByRole("link", { name: "← Не та книга? Все результаты" }).click();
  await expect(page).toHaveURL(/\/search\?q=sapiens\+harari$/);
  await expect(
    page.getByRole("heading", { name: "Sapiens: A Graphic History" }),
  ).toBeVisible();

  // Новый поиск после этого показывает свои результаты.
  await page.getByRole("searchbox").fill("the gift");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("Найдены 3 книги по запросу «the gift»")).toBeVisible();
});

test("выбор издания и фильтр по языку", async ({ page }) => {
  await page.goto("/book/OL17075811W");
  await expect(page.getByRole("heading", { name: "Издание не выбрано" })).toBeVisible();
  await expect(page.getByRole("link", { name: "← К поиску" })).toHaveAttribute(
    "href",
    "/",
  );

  const editions = page.getByRole("region", { name: "Выберите издание" });
  await editions.getByRole("link", { name: "русский", exact: true }).click();
  await expect(page).toHaveURL(/lang=rus/);
  const rows = editions.getByRole("list").last().getByRole("listitem");
  await expect(rows).toHaveCount(1);

  await rows.getByRole("link").click();
  await expect(page).toHaveURL(/lang=rus&edition=OL40000005M$/);
  await expect(
    page.getByRole("heading", {
      name: "Выбрано издание: Sapiens. Краткая история человечества, 2016",
    }),
  ).toBeVisible();
  await expect(rows.getByRole("link")).toHaveAttribute("aria-current", "true");

  // Выбор переживает перезагрузку: он хранится в адресе.
  await page.reload();
  await expect(rows.getByText("Выбрано")).toBeVisible();

  // Повторное нажатие снимает выбор.
  await rows.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Издание не выбрано" })).toBeVisible();

  await editions.getByRole("link", { name: "Все языки" }).click();
  await expect(rows).toHaveCount(5);
});

test("где читать: найденные копии и поиск в остальных библиотеках", async ({ page }) => {
  await page.goto("/book/OL17075811W");
  const section = page.getByRole("region", { name: "Где читать и слушать" });
  const found = section.getByRole("list", { name: "Найдено в библиотеках" });

  await expect(
    found.getByRole("link", { name: /Взять почитать на время.*Open Library/ }),
  ).toHaveAttribute("href", "https://openlibrary.org/works/OL17075811W");
  await expect(
    found.getByRole("link", { name: /Читать фрагмент.*Google Books/ }),
  ).toHaveAttribute("href", "https://books.google.com/books?id=FmyBAwAAQBAJ");
  await expect(found.getByRole("listitem")).toHaveCount(2);

  // Остальные восемь библиотек — ссылки на поиск именно этой книги.
  const search = section.locator("[data-library]");
  await expect(search).toHaveCount(8);
  await expect(section.locator('[data-library="gutenberg"]')).toHaveAttribute(
    "href",
    "https://www.gutenberg.org/ebooks/search/?query=Sapiens%20Yuval%20Noah%20Harari",
  );
  await expect(section.locator('[data-library="wikisource"]')).toHaveAttribute(
    "href",
    /^https:\/\/en\.wikisource\.org\/w\/index\.php\?search=Sapiens/,
  );
  for (const link of await search.all()) {
    await expect(link).toHaveAttribute("href", /^https:\/\//);
    await expect(link).toHaveAttribute("rel", "noreferrer");
  }
});

test("издание от другой книги в адресе игнорируется", async ({ page }) => {
  await page.goto("/book/OL17075811W?edition=OL99999999M&lang=zzz");
  await expect(page.getByRole("heading", { name: "Издание не выбрано" })).toBeVisible();
  await expect(page.getByText("Выбрано", { exact: true })).toHaveCount(0);
});

test("опечатка: нечёткий поиск находит книгу и говорит об этом", async ({ page }) => {
  await page.goto("/search?q=sapeins+harari");
  await expect(
    page.getByText(
      "Точного совпадения с «sapeins harari» нет. Показаны книги с похожими названиями.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText("Sapiens");
});

test("опечатка: запасной источник подсказывает исправленный запрос", async ({ page }) => {
  await page.goto("/search?q=garry+poter");
  await expect(page.getByText("Точного совпадения с «garry poter» нет.")).toBeVisible();
  await expect(
    page.getByText("«Harry Potter and the Philosopher's Stone J K Rowling»"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Harry Potter and the Philosopher's Stone" }),
  ).toBeVisible();
});

test("русское название переводится, если в каталоге нет русского издания", async ({
  page,
}) => {
  await page.goto(`/search?q=${encodeURIComponent("Атомные привычки")}`);
  await expect(
    page.getByText("Точного совпадения с «Атомные привычки» нет."),
  ).toBeVisible();
  await expect(page.getByText("«Atomic Habits James Clear»")).toBeVisible();
  await expect(page.getByRole("heading", { level: 3 }).first()).toHaveText(
    "Atomic Habits",
  );
});

test("кириллица: название показано по-русски", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("Мастер и Маргарита")}`);
  await expect(
    page.getByRole("heading", { name: "Мастер и Маргарита", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Михаил Афанасьевич Булгаков").first()).toBeVisible();
  await expect(page.getByText("1967 · 420 изданий")).toBeVisible();
});

test("ничего не найдено: понятное сообщение и советы", async ({ page }) => {
  await page.goto("/search?q=zzzzqqq");
  await expect(page.getByText("По запросу «zzzzqqq» ничего не найдено")).toBeVisible();
  await expect(page.getByText("Попробуйте название на языке оригинала.")).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("zzzzqqq");
});

test("каталог недоступен: сообщение и повтор, а не падение страницы", async ({
  page,
}) => {
  await page.goto("/search?q=catalogdown");
  await expect(page.getByText("Каталог книг сейчас не отвечает")).toBeVisible();
  await expect(page.getByRole("link", { name: "Повторить поиск" })).toHaveAttribute(
    "href",
    "/search?q=catalogdown",
  );

  await page.goto("/book/OL503W");
  await expect(page.getByText("Каталог книг сейчас не отвечает")).toBeVisible();
  await expect(page.getByRole("link", { name: "Обновить страницу" })).toBeVisible();
});

test("несуществующая книга и чужой идентификатор дают страницу «не найдено»", async ({
  page,
}) => {
  for (const path of ["/book/OL999W", "/book/not-a-book", "/book/OL17075811M"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Страница не найдена" }),
    ).toBeVisible();
  }
});

test("повторный запрос не обращается к каталогу", async ({ page, request }) => {
  // Уникальный запрос, чтобы прогон не зависел от прежнего содержимого кэша.
  const query = `gift ${Date.now()}`;
  const url = `/search?q=${encodeURIComponent(query)}`;

  await page.goto(url);
  await expect(page.getByRole("heading", { name: "The Gift" }).first()).toBeVisible();
  await page.goto("/");
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "The Gift" }).first()).toBeVisible();

  const counts = (await (
    await request.get(`${MOCK_CATALOG}/__requests`)
  ).json()) as Record<string, number>;
  expect(counts[`search:${query}`]).toBe(1);
});

for (const width of [360, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`результаты и страница книги: ${width} px, ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      if (theme === "light") {
        await page.addInitScript(() => localStorage.setItem("theme", "light"));
      }
      await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });

      for (const [name, path] of [
        ["results", "/search?q=sapiens+harari"],
        ["book", "/book/OL17075811W?q=sapiens+harari&edition=OL40000004M"],
      ]) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { name: "Sapiens" }).first(),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await expectNoHorizontalScroll(page);

        const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
        expect(axe.violations).toEqual([]);

        const screenshot = await page.screenshot({
          fullPage: true,
          path: testInfo.outputPath(`${name}-${width}-${theme}.png`),
        });
        await testInfo.attach(`${name}-${width}-${theme}`, {
          body: screenshot,
          contentType: "image/png",
        });
      }
    });
  }
}

test("страница книги: области нажатия на телефоне не меньше 44 px по высоте", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/book/OL17075811W?q=sapiens");
  await expect(page.getByText("Это та книга?")).toBeVisible();
  const targets = page.locator("#main").locator("a, summary");
  await expect.poll(() => targets.count()).toBeGreaterThan(8);
  const count = await targets.count();
  for (let index = 0; index < count; index += 1) {
    const box = await targets.nth(index).boundingBox();
    expect(box?.height ?? 0, await targets.nth(index).innerText()).toBeGreaterThanOrEqual(
      44,
    );
  }
});

test("поиск и страница книги не пишут ошибок в консоль", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/search?q=the+gift");
  await expect(page.getByRole("heading", { name: "The Gift" }).first()).toBeVisible();
  await page.goto("/search?q=sapiens+harari");
  await page.getByRole("link", { name: "Да, это она" }).click();
  await expect(page.getByText("Это та книга?")).toBeVisible();
  await page.getByRole("link", { name: "английский", exact: true }).click();
  await expect(page).toHaveURL(/lang=eng/);
  expect(errors).toEqual([]);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [360, 768, 1280, 1920] as const;
const THEMES = ["light", "dark"] as const;

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(
    overflow,
    "страница не должна прокручиваться по горизонтали",
  ).toBeLessThanOrEqual(0);
}

for (const theme of THEMES) {
  for (const width of WIDTHS) {
    test(`главная: ${width} px, ${theme}`, async ({ page }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      // Тёмная тема действует по умолчанию; светлая — сохранённый выбор пользователя.
      if (theme === "light") {
        await page.addInitScript(() => localStorage.setItem("theme", "light"));
      }
      await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(
        page.getByRole("searchbox", { name: "Название книги и автор" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Создать анализ" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Как это работает" })).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Как мы работаем с источниками" }),
      ).toBeVisible();
      await expectNoHorizontalScroll(page);

      // Тема действительно применилась: фон страницы совпадает с токеном --bg.
      const background = await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      );
      expect(background).toBe(
        theme === "dark" ? "rgb(13, 14, 18)" : "rgb(250, 250, 247)",
      );

      // Контраст и остальные правила WCAG 2.1 AA.
      const axe = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(axe.violations).toEqual([]);

      const screenshot = await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`home-${width}-${theme}.png`),
      });
      await testInfo.attach(`home-${width}-${theme}`, {
        body: screenshot,
        contentType: "image/png",
      });
    });
  }
}

test("области нажатия на телефоне не меньше 44 × 44 px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/");
  const targets = page.locator("header a, header button, form input, form button");
  const count = await targets.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < count; index += 1) {
    const target = targets.nth(index);
    if (!(await target.isVisible())) continue;
    const box = await target.boundingBox();
    expect(box, "у видимого элемента есть размеры").not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
});

test("поиск ведёт на страницу результатов", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox").fill("  Сапиенс   Харари ");
  await page.getByRole("button", { name: "Создать анализ" }).click();

  await expect(page).toHaveURL(/\/search\?q=/);
  expect(new URL(page.url()).searchParams.get("q")).toBe("  Сапиенс   Харари ");
  await expect(
    page.getByRole("heading", { level: 1, name: "Поиск книги" }),
  ).toBeVisible();
  await expect(page.getByText("«Сапиенс Харари»")).toBeVisible();
  await expect(page.getByRole("searchbox")).toHaveValue("Сапиенс Харари");
  await expect(page.getByText("Каталог книг ещё не подключён")).toBeVisible();
});

test("пустой запрос и запрос из пробелов не отправляются", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("searchbox");

  await field.press("Enter");
  await expect(page).toHaveURL(/\/$/);

  await field.fill("   ");
  await field.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  expect(await field.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(
    false,
  );
});

test("страница поиска без запроса просит ввести название", async ({ page }) => {
  await page.goto("/search");
  await expect(
    page.getByText("Введите название книги и автора, чтобы начать поиск."),
  ).toBeVisible();
  await expectNoHorizontalScroll(page);

  const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(axe.violations).toEqual([]);
});

test("вся главная проходится с клавиатуры", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const focused = () =>
    page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      return (
        element?.getAttribute("aria-label") ||
        element?.innerText?.trim() ||
        element?.getAttribute("name")
      );
    });

  const order: (string | null | undefined)[] = [];
  for (let step = 0; step < 7; step += 1) {
    await page.keyboard.press("Tab");
    order.push(await focused());
  }
  expect(order).toEqual([
    "Перейти к содержимому",
    "AI Book Intelligence",
    "Как это работает",
    "Источники",
    "Включить светлую тему",
    "q",
    "Создать анализ",
  ]);

  // Фокус виден: у активного элемента есть обводка.
  const outline = await page.evaluate(
    () => getComputedStyle(document.activeElement as Element).outlineStyle,
  );
  expect(outline).toBe("solid");

  // Запрос отправляется клавишей Enter.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.type("Атомные привычки");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
});

test("ссылка «Перейти к содержимому» переносит фокус в основную часть", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Перейти к содержимому" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("ссылки шапки ведут к разделам, логотип — на главную", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("link", { name: "Источники" }).click();
  await expect(page).toHaveURL(/#sources$/);
  await expect(
    page.getByRole("heading", { name: "Как мы работаем с источниками" }),
  ).toBeInViewport();

  await page.getByRole("link", { name: "Как это работает" }).click();
  await expect(page).toHaveURL(/#how$/);
  await expect(page.getByRole("heading", { name: "Как это работает" })).toBeInViewport();

  await page.goto("/search?q=test");
  await page.getByRole("link", { name: "AI Book Intelligence" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Не пересказ книги",
  );

  await page.goto("/search?q=test");
  await page.getByRole("link", { name: "← На главную" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("несуществующий адрес показывает страницу 404 со ссылкой на главную", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Страница не найдена" })).toBeVisible();
  await page.getByRole("link", { name: "На главную" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test.describe("тема", () => {
  test("по умолчанию тёмная, какой бы ни была системная настройка", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
    await expect(page.locator("html")).toHaveCSS("background-color", "rgb(13, 14, 18)");
    await expect(
      page.getByRole("button", { name: "Включить светлую тему" }),
    ).toBeVisible();
  });

  test("переключается кнопкой и сохраняется после перезагрузки", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Включить светлую тему" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveCSS(
      "background-color",
      "rgb(250, 250, 247)",
    );

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.locator("html")).toHaveCSS(
      "background-color",
      "rgb(250, 250, 247)",
    );

    await page.getByRole("button", { name: "Включить тёмную тему" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveCSS("background-color", "rgb(13, 14, 18)");
  });

  test("у переключателя виден ровно один значок, соответствующий теме", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".theme-icon-sun")).toBeVisible();
    await expect(page.locator(".theme-icon-moon")).toBeHidden();

    await page.getByRole("button", { name: "Включить светлую тему" }).click();
    await expect(page.locator(".theme-icon-moon")).toBeVisible();
    await expect(page.locator(".theme-icon-sun")).toBeHidden();
  });
});

test("в консоли нет ошибок", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await page.getByRole("searchbox").fill("Сапиенс");
  await page.getByRole("searchbox").press("Enter");
  await expect(page.getByText("Каталог книг ещё не подключён")).toBeVisible();
  expect(errors).toEqual([]);
});

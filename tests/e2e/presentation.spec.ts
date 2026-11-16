import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoHorizontalScroll, stubCovers } from "./helpers";

// Готовый анализ для тестов собран настоящим пайплайном на подставной модели
// (tests/fixtures/build-analysis.fixture.ts); книга в нём выдуманная.
const DEMO = "/analysis/demo";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.beforeEach(async ({ page }) => {
  await stubCovers(page);
});

test.describe("большой экран", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("слайды листаются кнопками, клавишами и из списка", async ({ page }) => {
    await page.goto(DEMO);
    const slides = page.locator("[data-slide]");
    await expect(slides).toHaveCount(1);
    await expect(
      page.getByRole("heading", { level: 2, name: "Тихие системы" }),
    ).toBeVisible();
    await expect(page.getByTestId("slide-counter")).toContainText("1 / 15");
    await expect(page.getByRole("button", { name: "Предыдущий слайд" })).toBeDisabled();

    await page.getByRole("button", { name: "Следующий слайд" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "О чём эта книга" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/#slide-2$/);

    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("heading", { level: 2, name: "Главные идеи" }),
    ).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(
      page.getByRole("heading", { level: 2, name: "О чём эта книга" }),
    ).toBeVisible();
    await page.keyboard.press("End");
    await expect(
      page.getByRole("heading", { level: 2, name: "AI-аналитика" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Следующий слайд" })).toBeDisabled();
    await page.keyboard.press("Home");
    await expect(page.getByTestId("slide-counter")).toContainText("1 / 15");

    const nav = page.getByRole("navigation", { name: "Слайды" });
    await nav.getByRole("link", { name: /Критический анализ/ }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Критический анализ" }),
    ).toBeVisible();
    await expect(nav.getByRole("link", { name: /Критический анализ/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(slides).toHaveCount(1);
  });

  test("ссылка на конкретный слайд открывает его", async ({ page }) => {
    await page.goto(`${DEMO}#slide-5`);
    await expect(
      page.getByRole("heading", { level: 2, name: "Сигнальный долг" }),
    ).toBeVisible();
    await expect(page.getByTestId("slide-counter")).toContainText("5 / 15");
  });

  test("режим чтения показывает все разделы ТЗ на одной странице", async ({ page }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Чтение" }).click();
    await expect(page.locator("[data-slide]")).toHaveCount(15);

    const titles = await page.locator("[data-slide] h2").allTextContents();
    for (const section of [
      "Тихие системы", // обложка
      "О чём эта книга",
      "Главные идеи",
      "Разбор по главам",
      "Сигнальный долг", // ключевые концепции
      "Самые ценные инсайты",
      "Практическое применение",
      "Психология и философия автора",
      "Критический анализ",
      "Связь с другими знаниями",
      "Главные выводы",
      "План внедрения",
      "AI-аналитика",
    ]) {
      expect(
        titles.some((title) => title.startsWith(section)),
        section,
      ).toBe(true);
    }

    await page.getByRole("button", { name: "Слайды", exact: true }).click();
    await expect(page.locator("[data-slide]")).toHaveCount(1);
  });

  test("источник утверждения открывается в один клик", async ({ page }) => {
    await page.goto(`${DEMO}#slide-5`);
    const dialog = page.getByRole("dialog");

    // Факт: источник, выдержка и результат проверки.
    await page
      .getByRole("button", { name: /Факт из книги.*открыть источник/ })
      .first()
      .click();
    await expect(dialog.getByRole("heading", { name: "Факт из книги" })).toBeVisible();
    await expect(dialog.getByText("Источники")).toBeVisible();
    await expect(dialog.locator("blockquote").first()).toContainText("сигнального долга");
    await expect(dialog.getByRole("link").first()).toHaveAttribute(
      "href",
      /^https?:\/\//,
    );
    await expect(
      dialog.getByText("Проверено: источник подтверждает утверждение."),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    // Вывод AI: видно, на каких фактах он построен, и к ним можно перейти.
    await page.keyboard.press("Home");
    await page
      .getByRole("button", { name: /Интерпретация AI.*открыть источник/ })
      .first()
      .click();
    await expect(dialog.getByRole("heading", { name: "Интерпретация AI" })).toBeVisible();
    await expect(dialog.getByText("На чём основан вывод")).toBeVisible();
    await dialog
      .getByRole("button", { name: /открыть источник/ })
      .first()
      .click();
    await expect(dialog.getByText("Источники")).toBeVisible();
    await dialog.getByRole("button", { name: "Закрыть" }).click();
    await expect(dialog).toBeHidden();
  });

  test("у каждого утверждения на каждом слайде есть метка с источником или основанием", async ({
    page,
  }) => {
    await page.goto(DEMO);
    await page.getByRole("button", { name: "Чтение" }).click();
    const claims = page.locator("[data-claim]");
    const count = await claims.count();
    expect(count).toBeGreaterThan(40);

    const dialog = page.getByRole("dialog");
    // Проверяем каждое пятое, чтобы тест оставался быстрым.
    for (let index = 0; index < count; index += 5) {
      await claims
        .nth(index)
        .getByRole("button", { name: /открыть источник/ })
        .click();
      await expect(
        dialog.getByText(/^(Источники|На чём основан вывод)$/).first(),
        `утверждение № ${index}`,
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("действия, схемы и оценки AI", async ({ page }) => {
    await page.goto(`${DEMO}#slide-3`);
    const action = page.locator("[data-action]").first();
    await expect(action.getByText("Что с этим делать")).toBeVisible();
    await action.getByRole("button", { name: "Из какой идеи это следует" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto(`${DEMO}#slide-5`);
    await expect(page.locator('[data-diagram="flow"]')).toBeVisible();
    await expect(page.locator('[data-diagram="flow"] li')).toHaveCount(3);
    await page.keyboard.press("ArrowRight");
    await expect(page.locator('[data-diagram="tree"]')).toBeVisible();

    await page.keyboard.press("End");
    await expect(page.locator("[data-score]")).toHaveCount(6);
    await expect(
      page.getByText("Оценки — мнение AI с объяснением, а не научный рейтинг."),
    ).toBeVisible();
    await expect(page.getByText("Самая сильная идея")).toBeVisible();
  });

  test("режим анализа виден на каждом слайде и объясняет, как сделан анализ", async ({
    page,
  }) => {
    await page.goto(DEMO);
    const mode = page.getByTestId("analysis-mode");
    for (let index = 0; index < 15; index += 1) {
      await expect(mode).toBeInViewport();
      await expect(mode).toHaveText("По открытым источникам");
      await page.keyboard.press("ArrowRight");
    }
    await mode.click();
    const dialog = page.getByRole("dialog", { name: "Как сделан этот анализ" });
    await expect(dialog.getByText("Текста книги у нас нет.")).toBeVisible();
    await expect(dialog.getByText("Проверено фактов")).toBeVisible();
    await expect(dialog.getByRole("listitem").first()).toBeVisible();
  });
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test("презентация — лента карточек с нижней панелью", async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.locator("[data-slide]")).toHaveCount(15);
    await expectNoHorizontalScroll(page);
    await expect(page.getByTestId("analysis-mode")).toBeInViewport();
    await expect(page.getByRole("button", { name: "Чтение" })).toBeHidden();

    // Список слайдов открывается снизу и переносит к выбранному.
    await page.getByRole("button", { name: "Слайды", exact: true }).click();
    const sheet = page.getByRole("dialog", { name: "Слайды" });
    await sheet.getByRole("link", { name: /План внедрения/ }).click();
    await expect(sheet).toBeHidden();
    await expect(
      page.getByRole("heading", { level: 2, name: "План внедрения" }),
    ).toBeInViewport();
    await expect(page.getByTestId("slide-counter")).toContainText("14 / 15");
    await expect(page.getByTestId("analysis-mode")).toBeInViewport();

    // Стрелки нижней панели листают к соседней карточке.
    await page.getByRole("button", { name: "Следующий слайд" }).click();
    await expect(
      page.getByRole("heading", { level: 2, name: "AI-аналитика" }),
    ).toBeInViewport();
  });

  test("области нажатия не меньше 44 px", async ({ page }) => {
    await page.goto(DEMO);
    await expect(page.locator("[data-slide]")).toHaveCount(15);
    const targets = page.locator("main button:visible, main a:visible");
    const count = await targets.count();
    expect(count).toBeGreaterThan(50);
    for (let index = 0; index < count; index += 3) {
      const box = await targets.nth(index).boundingBox();
      expect(
        box?.height ?? 0,
        await targets.nth(index).innerText(),
      ).toBeGreaterThanOrEqual(44);
    }
  });

  test("очень длинные слова и заголовки не ломают слайд", async ({ page }) => {
    await page.goto("/analysis/demo-long");
    await expect(page.locator("[data-slide]")).toHaveCount(15);
    await expectNoHorizontalScroll(page);
    const widest = await page.evaluate(() =>
      Math.max(
        ...[...document.querySelectorAll("[data-slide] *")].map(
          (el) => el.getBoundingClientRect().right,
        ),
      ),
    );
    expect(widest).toBeLessThanOrEqual(360);
  });
});

for (const width of [360, 1280]) {
  for (const theme of ["dark", "light"] as const) {
    test(`презентация: доступность и снимки, ${width} px, ${theme}`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      if (theme === "light") {
        await page.addInitScript(() => localStorage.setItem("theme", "light"));
      }
      await page.setViewportSize({ width, height: width < 768 ? 740 : 900 });
      await page.goto(`${DEMO}#slide-5`);
      await expect(
        page.getByRole("heading", { level: 2, name: "Сигнальный долг" }),
      ).toBeVisible();
      if (width >= 1024) await page.getByRole("button", { name: "Чтение" }).click();
      await page.evaluate(() => document.fonts.ready);
      await expectNoHorizontalScroll(page);

      const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);

      // С открытой карточкой источника — тоже.
      await page
        .getByRole("button", { name: /открыть источник/ })
        .first()
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const withDialog = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(withDialog.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual(
        [],
      );
      await page.keyboard.press("Escape");

      const screenshot = await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`presentation-${width}-${theme}.png`),
      });
      await testInfo.attach(`presentation-${width}-${theme}`, {
        body: screenshot,
        contentType: "image/png",
      });
    });
  }
}

test.describe("ход и исход анализа", () => {
  test("прерванный анализ: видно, что готово и что найдено", async ({ page }) => {
    await page.goto("/analysis/demo-interrupted");
    await expect(
      page.getByRole("heading", { level: 1, name: "Анализ прерван" }),
    ).toBeVisible();
    await expect(page.getByText("Тихие системы · Анна Верес")).toBeVisible();

    const steps = page.getByRole("list", { name: "Шаги анализа" }).getByRole("listitem");
    await expect(steps).toHaveCount(8);
    await expect(page.locator('[data-step="sources"]')).toHaveAttribute(
      "data-status",
      "done",
    );
    await expect(page.locator('[data-step="structure"]')).toHaveAttribute(
      "data-status",
      "pending",
    );
    await expect(
      page.getByRole("heading", { name: /Найдено источников: \d+/ }),
    ).toBeVisible();

    // Ключа модели в тестах нет: кнопки, которая ничего не сможет сделать, быть не должно.
    await expect(page.getByRole("button", { name: "Продолжить анализ" })).toHaveCount(0);
    await expect(
      page.getByText("Продолжить нельзя: на сервере не задан ключ Claude API."),
    ).toBeVisible();
    await expectNoHorizontalScroll(page);
    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
    expect(axe.violations).toEqual([]);
  });

  test("мало источников: объясняем, почему анализа нет", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/analysis/demo-halted");
    await expect(
      page.getByRole("heading", { level: 1, name: "Анализ не создан: мало источников" }),
    ).toBeVisible();
    await expect(page.locator("main [role=alert]")).toContainText(
      "выдавать догадки за содержание книги",
    );
    await expect(page.locator("main [role=alert]")).toContainText("Не хватает");
    await expect(page.getByRole("link", { name: "← К странице книги" })).toHaveAttribute(
      "href",
      "/book/OL0000000W",
    );
    await expectNoHorizontalScroll(page);
  });

  test("неизвестный анализ и чужой идентификатор — страница «не найдено»", async ({
    page,
  }) => {
    for (const path of ["/analysis/no-such-analysis", "/analysis/..%2F..%2Fetc"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "Страница не найдена" }),
      ).toBeVisible();
    }
  });

  test("страница книги без ключа модели честно говорит, что запуск недоступен", async ({
    page,
  }) => {
    await page.goto("/book/OL17075811W");
    await expect(
      page.getByText(
        "Запуск анализа сейчас недоступен: на сервере не задан ключ Claude API.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать анализ" })).toHaveCount(0);
  });

  test("в консоли нет ошибок", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(DEMO);
    await page.keyboard.press("ArrowRight");
    await page
      .getByRole("button", { name: /открыть источник/ })
      .first()
      .click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Чтение" }).click();
    await page.goto("/analysis/demo-interrupted");
    expect(errors).toEqual([]);
  });
});

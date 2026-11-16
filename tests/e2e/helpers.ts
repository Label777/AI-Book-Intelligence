import { expect, type Page } from "@playwright/test";

export const MOCK_CATALOG = `http://127.0.0.1:${process.env.MOCK_CATALOG_PORT ?? 3101}`;

// Прозрачная картинка 1 × 1: тесты не ходят за обложками во внешнюю сеть.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

export async function stubCovers(page: Page) {
  await page.route("https://covers.openlibrary.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: PIXEL }),
  );
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(
    overflow,
    "страница не должна прокручиваться по горизонтали",
  ).toBeLessThanOrEqual(0);
}

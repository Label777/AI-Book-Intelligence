import { expect, type Page } from "@playwright/test";

export const MOCK_CATALOG = `http://127.0.0.1:${process.env.MOCK_CATALOG_PORT ?? 3101}`;

// Прозрачная картинка 1 × 1: тесты не ходят за обложками во внешнюю сеть.
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Внешние адреса, к которым обращается сам браузер: обложки и проверка наличия книги
 * в библиотеках. В тестах они отвечают записанными данными, во внешнюю сеть тесты не ходят.
 */
export async function stubCovers(page: Page) {
  await page.route("https://covers.openlibrary.org/**", (route) =>
    route.fulfill({ contentType: "image/png", body: PIXEL }),
  );
  const json = (body: unknown) => ({
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
  await page.route("https://openlibrary.org/search.json**", (route) => {
    const q = new URL(route.request().url()).searchParams.get("q") ?? "";
    const sapiens = q === "key:/works/OL17075811W";
    return route.fulfill(
      json({
        docs: sapiens
          ? [
              {
                key: "/works/OL17075811W",
                ebook_access: "borrowable",
                ia: ["sapiens0000hara"],
              },
            ]
          : [],
      }),
    );
  });
  await page.route("https://gutendex.com/**", (route) =>
    route.fulfill(json({ results: [] })),
  );
  await page.route("https://www.googleapis.com/books/**", (route) =>
    route.fulfill(
      json({
        items: [
          {
            volumeInfo: {
              title: "Sapiens",
              authors: ["Yuval Noah Harari"],
              previewLink: "http://books.google.com/books?id=FmyBAwAAQBAJ",
            },
            accessInfo: { viewability: "PARTIAL" },
          },
        ],
      }),
    ),
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

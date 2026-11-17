// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  findAccess,
  isSameBook,
  LIBRARIES,
  parseGoogleAccess,
  parseGutenbergAccess,
  parseOpenLibraryAccess,
  wikisourceLanguage,
  type BookRef,
} from "@/books/libraries";
import { fakeClient } from "./fixtures";

const pride: BookRef = {
  workId: "OL66554W",
  title: "Pride and Prejudice",
  authors: ["Jane Austen"],
};
const sapiens: BookRef = {
  workId: "OL17075811W",
  title: "Sapiens",
  authors: ["Yuval Noah Harari"],
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

describe("список библиотек", () => {
  it("ровно десять, у каждой свой идентификатор и защищённый адрес поиска", () => {
    expect(LIBRARIES).toHaveLength(10);
    expect(new Set(LIBRARIES.map((library) => library.id)).size).toBe(10);
    for (const library of LIBRARIES) {
      const url = new URL(library.searchUrl(pride));
      expect(url.protocol, library.id).toBe("https:");
      expect(library.about.length, library.id).toBeGreaterThan(10);
    }
  });

  it("название и автор попадают в адрес поиска закодированными", () => {
    const tricky: BookRef = {
      workId: "OL1W",
      title: 'A & B: "C"? #1',
      authors: ["O'Neil <x>"],
    };
    for (const library of LIBRARIES.filter((item) => item.id !== "openlibrary")) {
      const url = library.searchUrl(tricky);
      expect(url, library.id).not.toMatch(/[<>"# ]/);
      expect(decodeURIComponent(url), library.id).toContain('A & B: "C"? #1');
    }
  });

  it("Викитека выбирается по языку названия", () => {
    expect(wikisourceLanguage("Кобзар і Гайдамаки")).toBe("uk");
    expect(wikisourceLanguage("Мастер и Маргарита")).toBe("ru");
    expect(wikisourceLanguage("Pride and Prejudice")).toBe("en");
  });
});

describe("isSameBook", () => {
  it("узнаёт ту же книгу при другой записи автора и подзаголовке", () => {
    expect(isSameBook(pride, "Pride and Prejudice", ["Austen, Jane"])).toBe(true);
    expect(
      isSameBook(sapiens, "Sapiens: A Brief History of Humankind", ["Yuval Noah Harari"]),
    ).toBe(true);
  });

  it("не путает с другой книгой, пересказом или другим автором", () => {
    expect(
      isSameBook(pride, "Pride and Prejudice and Zombies", ["Seth Grahame-Smith"]),
    ).toBe(false);
    expect(isSameBook(pride, "Pride and Prejudice", ["Somebody Else"])).toBe(false);
    expect(
      isSameBook(pride, "Summary of Pride and Prejudice by Jane Austen", ["Jane Austen"]),
    ).toBe(false);
    expect(isSameBook(pride, "Prejudice", ["Jane Austen"])).toBe(false);
    expect(isSameBook(pride, "", ["Jane Austen"])).toBe(false);
  });
});

describe("разбор ответов библиотек", () => {
  it("Open Library: свободная копия ведёт в Internet Archive, выдаваемая — в Open Library", () => {
    const doc = (extra: object) => ({ docs: [{ key: "/works/OL66554W", ...extra }] });
    expect(
      parseOpenLibraryAccess(
        doc({ ebook_access: "public", ia: ["pridejudice00aust"] }),
        pride,
      ),
    ).toEqual([
      {
        libraryId: "archive",
        kind: "read",
        url: "https://archive.org/details/pridejudice00aust",
      },
    ]);
    expect(
      parseOpenLibraryAccess(doc({ ebook_access: "borrowable", ia: ["x"] }), pride),
    ).toEqual([
      {
        libraryId: "openlibrary",
        kind: "borrow",
        url: "https://openlibrary.org/works/OL66554W",
      },
    ]);
    expect(parseOpenLibraryAccess(doc({ ebook_access: "no_ebook" }), pride)).toEqual([]);
    expect(
      parseOpenLibraryAccess(doc({ ebook_access: "printdisabled", ia: ["x"] }), pride),
    ).toEqual([]);
  });

  it("Open Library: чужая запись и странный идентификатор скана не дают ссылки", () => {
    expect(
      parseOpenLibraryAccess(
        { docs: [{ key: "/works/OL1W", ebook_access: "public", ia: ["a"] }] },
        pride,
      ),
    ).toEqual([]);
    expect(
      parseOpenLibraryAccess(
        {
          docs: [
            { key: "/works/OL66554W", ebook_access: "public", ia: ["../../evil?x=1"] },
          ],
        },
        pride,
      ),
    ).toEqual([]);
    expect(parseOpenLibraryAccess(null, pride)).toEqual([]);
  });

  it("Gutenberg: берёт первую запись именно этой книги", () => {
    const body = {
      results: [
        {
          id: 42671,
          title: "Pride and Prejudice, a play",
          authors: [{ name: "Mackaye, Mary" }],
        },
        { id: 1342, title: "Pride and Prejudice", authors: [{ name: "Austen, Jane" }] },
      ],
    };
    expect(parseGutenbergAccess(body, pride)).toEqual([
      {
        libraryId: "gutenberg",
        kind: "read",
        url: "https://www.gutenberg.org/ebooks/1342",
      },
    ]);
    expect(
      parseGutenbergAccess(
        { results: [{ id: "1; DROP", title: "Pride and Prejudice", authors: [] }] },
        pride,
      ),
    ).toEqual([]);
    expect(parseGutenbergAccess({ count: 0 }, pride)).toEqual([]);
  });

  it("Google Books: полный текст важнее фрагмента, а ссылка — только на Google", () => {
    const item = (viewability: string, previewLink: string, title = "Sapiens") => ({
      volumeInfo: { title, authors: ["Yuval Noah Harari"], previewLink },
      accessInfo: { viewability },
    });
    const link = "http://books.google.com/books?id=A1";
    expect(
      parseGoogleAccess(
        { items: [item("PARTIAL", link), item("ALL_PAGES", link)] },
        sapiens,
      ),
    ).toEqual([
      { libraryId: "google", kind: "read", url: "https://books.google.com/books?id=A1" },
    ]);
    expect(parseGoogleAccess({ items: [item("PARTIAL", link)] }, sapiens)[0].kind).toBe(
      "preview",
    );
    expect(parseGoogleAccess({ items: [item("NO_PAGES", link)] }, sapiens)).toEqual([]);
    expect(
      parseGoogleAccess(
        { items: [item("ALL_PAGES", "https://evil.example/books?id=A1")] },
        sapiens,
      ),
    ).toEqual([]);
    expect(
      parseGoogleAccess({ items: [item("ALL_PAGES", "javascript:alert(1)")] }, sapiens),
    ).toEqual([]);
    expect(
      parseGoogleAccess({ items: [item("ALL_PAGES", link, "Homo Deus")] }, sapiens),
    ).toEqual([]);
  });
});

describe("findAccess", () => {
  it("собирает результаты трёх библиотек", async () => {
    const { client } = fakeClient([
      [
        () => true,
        {
          docs: [{ key: "/works/OL66554W", ebook_access: "public", ia: ["pride00aust"] }],
        },
      ],
    ]);
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("/books/v1/volumes")
        ? json({
            items: [
              {
                volumeInfo: {
                  title: "Pride and Prejudice",
                  authors: ["Jane Austen"],
                  previewLink: "https://books.google.com/books?id=B2",
                },
                accessInfo: { viewability: "ALL_PAGES" },
              },
            ],
          })
        : json({
            results: [
              {
                id: 1342,
                title: "Pride and Prejudice",
                authors: [{ name: "Austen, Jane" }],
              },
            ],
          }),
    );
    const found = await findAccess(pride, {
      client,
      fetch: fetchMock as unknown as typeof fetch,
    });
    expect(found.map((item) => item.libraryId)).toEqual([
      "archive",
      "gutenberg",
      "google",
    ]);

    const urls = fetchMock.mock.calls.map(([url]) => new URL(url));
    expect(urls[0].origin + urls[0].pathname).toBe("https://gutendex.com/books");
    expect(urls[0].searchParams.get("search")).toBe("Pride and Prejudice Jane Austen");
    expect(urls[1].searchParams.get("q")).toBe(
      'intitle:"Pride and Prejudice" inauthor:"Jane Austen"',
    );
  });

  it("сбой одной библиотеки не мешает остальным", async () => {
    const { client } = fakeClient([[() => true, new Error("каталог недоступен")]]);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("gutendex")) throw new TypeError("Failed to fetch");
      return json({}, 429);
    });
    expect(
      await findAccess(pride, { client, fetch: fetchMock as unknown as typeof fetch }),
    ).toEqual([]);

    const working = vi.fn(async (url: string) =>
      url.includes("gutendex")
        ? json({
            results: [
              {
                id: 1342,
                title: "Pride and Prejudice",
                authors: [{ name: "Austen, Jane" }],
              },
            ],
          })
        : json({}, 500),
    );
    const found = await findAccess(pride, {
      client,
      fetch: working as unknown as typeof fetch,
    });
    expect(found).toEqual([
      {
        libraryId: "gutenberg",
        kind: "read",
        url: "https://www.gutenberg.org/ebooks/1342",
      },
    ]);
  });
});

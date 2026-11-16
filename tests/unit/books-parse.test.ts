import { describe, expect, it } from "vitest";
import {
  cleanDescription,
  coverUrl,
  idFromKey,
  parseAuthorName,
  parseEditions,
  parseSearchResponse,
  parseWork,
  parseYear,
} from "@/books/openlibrary/parse";
import { CatalogError } from "@/books/types";
import { fixture } from "./fixtures";

describe("разбор поиска", () => {
  it("читает произведения и нормализует авторов", () => {
    const { total, candidates } = parseSearchResponse(fixture("search-sapiens.json"));
    expect(total).toBe(4);
    expect(candidates[0]).toEqual({
      workId: "OL17075811W",
      title: "Sapiens",
      subtitle: "A Brief History of Humankind",
      authors: ["Yuval Noah Harari"],
      firstPublishYear: 2011,
      editionCount: 86,
      coverUrl: "https://covers.openlibrary.org/b/id/8634250-M.jpg",
      languages: ["eng", "spa", "rus", "ger", "fre"],
    });
    expect(candidates[2].authors).toEqual(["Yuval Noah Harari"]);
  });

  it("берёт название издания на языке запроса, если каталог его подобрал", () => {
    const body = {
      docs: [
        {
          key: "/works/OL1W",
          title: "Sapiens",
          editions: { docs: [{ title: "Sapiens. Краткая история человечества" }] },
        },
      ],
    };
    const [book] = parseSearchResponse(body).candidates;
    expect(book.title).toBe("Sapiens. Краткая история человечества");
    expect(book.subtitle).toBe("Sapiens");
  });

  it("пропускает записи без ключа или названия и не падает на мусоре", () => {
    const body = {
      numFound: "много",
      docs: [
        null,
        "строка",
        { key: "/works/OL1W" },
        { title: "Без ключа" },
        { key: "/authors/OL1A", title: "Не произведение" },
        {
          key: "/works/OL2W",
          title: "Годная",
          author_name: "не массив",
          edition_count: -5,
          cover_i: -1,
        },
      ],
    };
    const { total, candidates } = parseSearchResponse(body);
    expect(candidates).toEqual([
      { workId: "OL2W", title: "Годная", authors: [], languages: [] },
    ]);
    expect(total).toBe(1);
  });

  it("сообщает об ответе не той формы", () => {
    expect(() => parseSearchResponse({ error: "boom" })).toThrow(CatalogError);
    expect(() => parseSearchResponse(null)).toThrow(CatalogError);
  });
});

describe("разбор произведения", () => {
  it("читает настоящую запись «Sapiens»", () => {
    const work = parseWork(fixture("work-OL17075811W.json"));
    expect(work.workId).toBe("OL17075811W");
    expect(work.title).toBe("Sapiens");
    expect(work.subtitle).toBe("A Brief History of Humankind");
    expect(work.authorIds).toEqual(["OL3778242A"]);
    expect(work.coverUrl).toBe("https://covers.openlibrary.org/b/id/8634250-M.jpg");
    expect(work.description).toMatch(/^From a renowned historian/);
    expect(work.description).not.toContain("\r");
  });

  it("оставляет только темы, похожие на обычные слова", () => {
    const { subjects } = parseWork(fixture("work-OL17075811W.json"));
    expect(subjects).toContain("World history");
    expect(subjects.join("|")).not.toMatch(/nyt:|599|SCIENCE \/|Cb113/);
    expect(subjects.length).toBeLessThanOrEqual(8);
  });

  it("понимает описание-объект и старую форму списка авторов", () => {
    const work = parseWork({
      key: "/works/OL5W",
      title: "Книга",
      description: { type: "/type/text", value: "Текст описания" },
      authors: [
        { key: "/authors/OL7A" },
        { author: "/authors/OL8A" },
        { author: { key: "/authors/OL7A" } },
      ],
      first_publish_date: "March 1998",
    });
    expect(work.description).toBe("Текст описания");
    expect(work.authorIds).toEqual(["OL7A", "OL8A"]);
    expect(work.firstPublishYear).toBe(1998);
  });

  it("не принимает запись без названия", () => {
    expect(() => parseWork({ key: "/works/OL5W" })).toThrow(CatalogError);
  });
});

describe("разбор изданий", () => {
  it("читает издания и пропускает записи без названия", () => {
    const { total, editions } = parseEditions(fixture("editions-OL17075811W.json"));
    expect(total).toBe(86);
    expect(editions).toHaveLength(5);
    expect(editions[3]).toEqual({
      id: "OL40000004M",
      title: "Sapiens",
      subtitle: "A Brief History of Humankind",
      publishers: ["Harper"],
      year: 2015,
      languages: ["eng"],
      isbn: "0062316095",
      pages: 443,
      coverUrl: "https://covers.openlibrary.org/b/id/8634250-M.jpg",
    });
    expect(editions[0].languages).toEqual([]);
    expect(editions[0].isbn).toBe("9788466361903");
  });

  it("сообщает об ответе без списка", () => {
    expect(() => parseEditions({ size: 3 })).toThrow(CatalogError);
  });
});

describe("мелкие разборщики", () => {
  it("idFromKey", () => {
    expect(idFromKey("/works/OL17075811W", "W")).toBe("OL17075811W");
    expect(idFromKey("/books/OL1M", "W")).toBeUndefined();
    expect(idFromKey(42, "W")).toBeUndefined();
  });

  it("parseYear", () => {
    expect(parseYear("February 10, 2015")).toBe(2015);
    expect(parseYear("2015-03-01")).toBe(2015);
    expect(parseYear(1967)).toBe(1967);
    expect(parseYear("n.d.")).toBeUndefined();
    expect(parseYear("12345")).toBeUndefined();
  });

  it("coverUrl", () => {
    expect(coverUrl(12, "L")).toBe("https://covers.openlibrary.org/b/id/12-L.jpg");
    expect(coverUrl(-1)).toBeUndefined();
    expect(coverUrl("12")).toBeUndefined();
  });

  it("parseAuthorName", () => {
    expect(parseAuthorName(fixture("author-OL3778242A.json"))).toBe("Yuval Noah Harari");
    expect(parseAuthorName({ personal_name: "Имя" })).toBe("Имя");
    expect(parseAuthorName(null)).toBeUndefined();
  });

  it("cleanDescription убирает разметку, ссылки и служебный хвост", () => {
    const raw =
      "A **bold** claim and a [link](https://example.org) and [ref][1].\r\n\r\n\r\n\r\nSecond.\n\n----------\nAlso contained in:\n[1]: https://example.org";
    expect(cleanDescription(raw)).toBe("A bold claim and a link and ref.\n\nSecond.");
    expect(cleanDescription("   ")).toBeUndefined();
    expect(cleanDescription(undefined)).toBeUndefined();
  });
});

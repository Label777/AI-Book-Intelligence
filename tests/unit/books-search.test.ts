import { describe, expect, it, vi } from "vitest";
import { catalogQuery, fuzzyQuery, searchBooks, searchPath } from "@/books/search";
import { CatalogError } from "@/books/types";
import {
  EDITIONS_PAGE_SIZE,
  getBook,
  isEditionId,
  isWorkId,
  sortEditions,
} from "@/books/work";
import { fakeClient, fixture, queryOf } from "./fixtures";

const isSearch = (path: string) => path.startsWith("/search.json");
const empty = fixture("search-empty.json");

describe("подготовка запроса", () => {
  it("catalogQuery убирает кавычки и знаки, сохраняя дефис и апостроф", () => {
    expect(catalogQuery("«Сапиенс», Юваль Ной Харари")).toBe("Сапиенс Юваль Ной Харари");
    expect(catalogQuery('"Catch-22": Heller\'s (novel)')).toBe("Catch-22 Heller's novel");
    expect(catalogQuery("title:* OR [x TO y]")).toBe("title OR x TO y");
    expect(catalogQuery("!!!")).toBe("");
  });

  it("fuzzyQuery разрешает опечатки только в словах от четырёх букв", () => {
    expect(fuzzyQuery("sapeins by harrari")).toBe("sapeins~ by harrari~");
    expect(fuzzyQuery("it")).toBeNull();
  });

  it("searchPath кодирует запрос и просит название на нужном языке", () => {
    const url = new URL(searchPath("Мастер и Маргарита", "ru"), "https://example.org");
    expect(url.pathname).toBe("/search.json");
    expect(url.searchParams.get("q")).toBe("Мастер и Маргарита");
    expect(url.searchParams.get("lang")).toBe("ru");
    expect(url.searchParams.get("fields")).toContain("editions.title");
  });
});

describe("searchBooks", () => {
  it("находит книгу одним запросом и уверен в результате", async () => {
    const { client, paths } = fakeClient([[isSearch, fixture("search-sapiens.json")]]);
    const outcome = await searchBooks("  Sapiens,   Harari ", { client, suggest: null });

    expect(outcome.query).toBe("Sapiens, Harari");
    expect(outcome.strategy).toBe("exact");
    expect(outcome.confidence).toBe("high");
    expect(outcome.candidates[0].workId).toBe("OL17075811W");
    expect(outcome.candidates.map((item) => item.workId)).not.toContain("OL20000002W");
    expect(paths).toHaveLength(1);
    expect(queryOf(paths[0])).toBe("Sapiens Harari");
  });

  it("при опечатке повторяет поиск нечётко", async () => {
    const { client, paths } = fakeClient([
      [
        (path) => isSearch(path) && queryOf(path).includes("~"),
        fixture("search-sapiens.json"),
      ],
      [isSearch, empty],
    ]);
    const suggest = vi.fn();
    const outcome = await searchBooks("sapeins harrari", { client, suggest });

    expect(paths.map(queryOf)).toEqual(["sapeins harrari", "sapeins~ harrari~"]);
    expect(outcome.strategy).toBe("fuzzy");
    expect(outcome.candidates[0].workId).toBe("OL17075811W");
    // Нечёткий поиск справился — запасной источник не тревожим.
    expect(suggest).not.toHaveBeenCalled();
    // После исправления не утверждаем, что уверены.
    expect(outcome.confidence).toBe("medium");
  });

  it("если и нечёткий поиск пуст, берёт исправленное название у запасного источника", async () => {
    const { client, paths } = fakeClient([
      [
        (path) => isSearch(path) && queryOf(path).includes("Philosopher"),
        fixture("search-potter.json"),
      ],
      [isSearch, empty],
    ]);
    const suggest = vi.fn().mockResolvedValue({
      title: "Harry Potter and the Philosopher's Stone",
      author: "J. K. Rowling",
    });
    const outcome = await searchBooks("garry poter", { client, suggest });

    expect(suggest).toHaveBeenCalledWith("garry poter");
    expect(paths).toHaveLength(3);
    expect(outcome.strategy).toBe("corrected");
    expect(outcome.correctedQuery).toBe(
      "Harry Potter and the Philosopher's Stone J K Rowling",
    );
    expect(outcome.candidates[0].workId).toBe("OL82563W");
  });

  it("ничего не нашлось нигде — пустой результат без ошибки", async () => {
    const { client } = fakeClient([[isSearch, empty]]);
    const outcome = await searchBooks("zzzzqqq", { client, suggest: async () => null });
    expect(outcome.candidates).toEqual([]);
    expect(outcome.confidence).toBe("low");
  });

  it("запрос из одних знаков не уходит в каталог", async () => {
    const { client, paths } = fakeClient([[isSearch, empty]]);
    const outcome = await searchBooks("?!…", { client, suggest: null });
    expect(outcome.candidates).toEqual([]);
    expect(paths).toEqual([]);
  });

  it("для кириллицы просит русские названия", async () => {
    const { client, paths } = fakeClient([[isSearch, fixture("search-master.json")]]);
    const outcome = await searchBooks("Мастер и Маргарита", { client, suggest: null });
    expect(new URL(paths[0], "https://e.org").searchParams.get("lang")).toBe("ru");
    expect(outcome.candidates[0].title).toBe("Мастер и Маргарита");
    expect(outcome.candidates[0].authors[0]).toBe("Михаил Афанасьевич Булгаков");
  });

  it("сбой каталога пробрасывается как CatalogError", async () => {
    const { client } = fakeClient([
      [isSearch, new CatalogError("unavailable", "нет ответа")],
    ]);
    await expect(
      searchBooks("sapiens", { client, suggest: null }),
    ).rejects.toBeInstanceOf(CatalogError);
  });

  it("выдаёт не больше десяти кандидатов", async () => {
    const docs = Array.from({ length: 20 }, (_, index) => ({
      key: `/works/OL${index + 1}W`,
      title: `Dune ${index}`,
      author_name: [`Author ${index}`],
    }));
    const { client } = fakeClient([[isSearch, { docs }]]);
    const outcome = await searchBooks("dune", { client, suggest: null });
    expect(outcome.candidates).toHaveLength(10);
  });
});

describe("getBook", () => {
  const routes = (): Parameters<typeof fakeClient>[0] => [
    [(path) => path === "/works/OL17075811W.json", fixture("work-OL17075811W.json")],
    [
      (path) => path.startsWith("/works/OL17075811W/editions.json"),
      fixture("editions-OL17075811W.json"),
    ],
    [(path) => path === "/authors/OL3778242A.json", fixture("author-OL3778242A.json")],
    [isSearch, fixture("search-key-sapiens.json")],
  ];

  it("собирает произведение, автора и издания", async () => {
    const { client, paths } = fakeClient(routes());
    const book = await getBook("OL17075811W", client);

    expect(book).toMatchObject({
      workId: "OL17075811W",
      title: "Sapiens",
      authors: ["Yuval Noah Harari"],
      firstPublishYear: 2011,
      editionTotal: 86,
    });
    expect(book?.editions).toHaveLength(5);
    // Новые издания выше; издание без года — в конце.
    expect(book?.editions.map((edition) => edition.year)).toEqual([
      2024, 2024, 2022, 2016, 2015,
    ]);
    expect(paths).toContain(
      `/works/OL17075811W/editions.json?limit=${EDITIONS_PAGE_SIZE}`,
    );
  });

  it("обходится без сводки и без автора, если эти запросы не удались", async () => {
    const [work, editions] = routes();
    const { client } = fakeClient([
      work,
      editions,
      [
        (path) => path.startsWith("/authors/"),
        new CatalogError("unavailable", "нет ответа"),
      ],
      [isSearch, new CatalogError("unavailable", "нет ответа")],
    ]);
    const book = await getBook("OL17075811W", client);
    expect(book?.title).toBe("Sapiens");
    expect(book?.authors).toEqual([]);
    // Загружены не все издания — год первой публикации по ним не определяем.
    expect(book?.firstPublishYear).toBeUndefined();
    expect(book?.editionTotal).toBe(86);
  });

  it("возвращает null для несуществующего произведения и чужих идентификаторов", async () => {
    const { client, paths } = fakeClient([]);
    expect(await getBook("OL999W", client)).toBeNull();
    const before = paths.length;
    expect(await getBook("../../etc/passwd", client)).toBeNull();
    expect(await getBook("OL1M", client)).toBeNull();
    expect(paths.length).toBe(before);
  });

  it("сбой основной записи пробрасывается", async () => {
    const { client } = fakeClient([
      [() => true, new CatalogError("unavailable", "нет ответа")],
    ]);
    await expect(getBook("OL17075811W", client)).rejects.toBeInstanceOf(CatalogError);
  });

  it("проверяет идентификаторы", () => {
    expect(isWorkId("OL17075811W")).toBe(true);
    expect(isWorkId("OL17075811M")).toBe(false);
    expect(isWorkId("OLW")).toBe(false);
    expect(isWorkId("OL1W/../x")).toBe(false);
    expect(isEditionId("OL40000004M")).toBe(true);
    expect(isEditionId("OL1W")).toBe(false);
  });

  it("sortEditions не меняет исходный список", () => {
    const list = [
      { id: "OL1M", title: "Б", publishers: [], languages: [] },
      { id: "OL2M", title: "А", publishers: [], languages: [], year: 2001 },
      { id: "OL3M", title: "А", publishers: [], languages: [] },
    ];
    expect(sortEditions(list).map((edition) => edition.id)).toEqual([
      "OL2M",
      "OL3M",
      "OL1M",
    ]);
    expect(list[0].id).toBe("OL1M");
  });
});

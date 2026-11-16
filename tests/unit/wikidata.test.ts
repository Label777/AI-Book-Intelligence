import { describe, expect, it, vi } from "vitest";
import { createWikidataSuggest, firstSuggestion, searchVariants } from "@/books/wikidata";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** fetch, отвечающий по параметрам запроса к API Wikidata. */
function wikidata(handler: (params: URLSearchParams) => unknown) {
  const calls: URLSearchParams[] = [];
  const fetchMock = vi.fn(async (url: string) => {
    const params = new URL(url).searchParams;
    calls.push(params);
    const body = handler(params);
    if (body instanceof Error) throw body;
    return body instanceof Response ? body : json(body);
  });
  return {
    suggest: createWikidataSuggest({ fetch: fetchMock as unknown as typeof fetch }),
    calls,
  };
}

const book = {
  labels: { en: { value: "Atomic Habits" } },
  claims: { P50: [{ mainsnak: { datavalue: { value: { id: "Q2" } } } }] },
};

describe("searchVariants", () => {
  it("для длинного запроса пробует без последнего и без первого слова", () => {
    expect(searchVariants("Чёрный лебедь Талеб")).toEqual([
      "чёрный лебедь талеб",
      "чёрный лебедь",
      "лебедь талеб",
    ]);
    expect(searchVariants("Атомные привычки")).toEqual(["атомные привычки"]);
  });
});

describe("подсказка Wikidata", () => {
  it("переводит русское название и находит автора", async () => {
    const { suggest, calls } = wikidata((params) => {
      if (params.get("action") === "wbsearchentities")
        return { search: [{ id: "Q9" }, { id: "Q1" }] };
      if (params.get("ids") === "Q9|Q1") {
        // Q9 — не книга: автора нет. Берём следующую находку.
        return {
          entities: { Q9: { labels: { en: { value: "Habit" } }, claims: {} }, Q1: book },
        };
      }
      return { entities: { Q2: { labels: { en: { value: "James Clear" } } } } };
    });

    expect(await suggest("Атомные привычки")).toEqual({
      title: "Atomic Habits",
      author: "James Clear",
    });
    expect(calls[0].get("language")).toBe("ru");
    expect(calls[0].get("search")).toBe("атомные привычки");
    expect(calls).toHaveLength(3);
  });

  it("если полный запрос не найден, пробует без имени автора", async () => {
    const { suggest, calls } = wikidata((params) => {
      if (params.get("action") === "wbsearchentities") {
        return { search: params.get("search") === "чёрный лебедь" ? [{ id: "Q1" }] : [] };
      }
      if (params.get("ids") === "Q1") return { entities: { Q1: book } };
      return { entities: {} };
    });
    // Имя автора не нашлось — название всё равно возвращаем.
    expect(await suggest("Чёрный лебедь Талеб")).toEqual({
      title: "Atomic Habits",
      author: undefined,
    });
    expect(
      calls.filter((params) => params.get("action") === "wbsearchentities"),
    ).toHaveLength(2);
  });

  it("ничего не нашлось, сбой сети или ответ не той формы — подсказки нет", async () => {
    expect(await wikidata(() => ({ search: [] })).suggest("zzz")).toBeNull();
    expect(await wikidata(() => new TypeError("fetch failed")).suggest("zzz")).toBeNull();
    expect(await wikidata(() => json({}, 503)).suggest("zzz")).toBeNull();
    expect(await wikidata(() => "строка").suggest("zzz")).toBeNull();
    expect(
      await wikidata((params) =>
        params.get("action") === "wbsearchentities"
          ? { search: [{ id: "DROP TABLE" }, { id: 5 }] }
          : {},
      ).suggest("zzz"),
    ).toBeNull();
  });
});

describe("firstSuggestion", () => {
  it("спрашивает источники по очереди до первой подсказки", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const second = vi.fn().mockResolvedValue({ title: "A" });
    const third = vi.fn();
    expect(await firstSuggestion(first, second, third)("q")).toEqual({ title: "A" });
    expect(third).not.toHaveBeenCalled();
  });
});

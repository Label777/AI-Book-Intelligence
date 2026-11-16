import { describe, expect, it, vi } from "vitest";
import { createGoogleBooksSuggest } from "@/books/google-books";
import {
  CATALOG_TTL_MS,
  createCatalogClient,
  NOT_FOUND_TTL_MS,
  userAgent,
} from "@/books/openlibrary/client";
import { CatalogError } from "@/books/types";
import { MemoryCache } from "@/lib/cache";
import { createRateLimiter } from "@/lib/rate-limit";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });

function setup(
  responses: (Response | Error)[],
  extra: Parameters<typeof createCatalogClient>[0] = {},
) {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("лишний запрос");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleep = vi.fn(async () => {});
  const client = createCatalogClient({
    fetch: fetchMock as unknown as typeof fetch,
    waitTurn: async () => {},
    sleep,
    ...extra,
  });
  return { client, fetchMock, sleep };
}

describe("клиент каталога", () => {
  it("представляется и запрашивает JSON", async () => {
    const { client, fetchMock } = setup([json({ ok: true })]);
    expect(await client.getJson("/works/OL1W.json")).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://openlibrary.org/works/OL1W.json");
    const headers = init.headers as Record<string, string>;
    expect(headers["User-Agent"]).toMatch(
      /^AIBookIntelligence\/[\d.]+ \(\+https:\/\/github\.com\//,
    );
  });

  it("в User-Agent нет почты, пока её не задали явно", () => {
    expect(userAgent(undefined)).not.toContain("@");
    expect(userAgent("books@example.org")).toContain("; books@example.org)");
  });

  it("повторный запрос не обращается к каталогу", async () => {
    const { client, fetchMock } = setup([json({ n: 1 })]);
    await client.getJson("/a.json");
    expect(await client.getJson("/a.json")).toEqual({ n: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("одновременные одинаковые запросы ждут один ответ", async () => {
    const { client, fetchMock } = setup([json({ n: 1 })]);
    const [a, b] = await Promise.all([
      client.getJson("/a.json"),
      client.getJson("/a.json"),
    ]);
    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("404 — это «нет записи», и он тоже запоминается", async () => {
    const { client, fetchMock } = setup([json({}, 404)]);
    expect(await client.getJson("/works/OL9W.json")).toBeNull();
    expect(await client.getJson("/works/OL9W.json")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("хранит ответы 30 дней, а «не найдено» — сутки", async () => {
    let now = 0;
    const cache = new MemoryCache({ now: () => now });
    const { client, fetchMock } = setup(
      [json({ n: 1 }), json({}, 404), json({ n: 2 }), json({ n: 3 })],
      {
        cache,
      },
    );
    await client.getJson("/found.json");
    await client.getJson("/missing.json");

    now = NOT_FOUND_TTL_MS + 1;
    expect(await client.getJson("/found.json")).toEqual({ n: 1 });
    expect(await client.getJson("/missing.json")).toEqual({ n: 2 });

    now = CATALOG_TTL_MS + 1;
    expect(await client.getJson("/found.json")).toEqual({ n: 3 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("повторяет запрос после сбоя сервера и сети", async () => {
    const { client, fetchMock, sleep } = setup([
      json({}, 503),
      new TypeError("fetch failed"),
      json({ ok: 1 }),
    ]);
    expect(await client.getJson("/a.json")).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("при ответе 429 ждёт столько, сколько просит каталог, но не больше 10 секунд", async () => {
    const { client, sleep } = setup([
      json({}, 429, { "retry-after": "3" }),
      json({}, 429, { "retry-after": "600" }),
      json({ ok: 1 }),
    ]);
    await client.getJson("/a.json");
    expect(sleep.mock.calls).toEqual([[3000], [10000]]);
  });

  it("после исчерпания повторов сообщает причину и не кэширует сбой", async () => {
    const { client, fetchMock } = setup([
      json({}, 429),
      json({}, 429),
      json({}, 429),
      json({ ok: 1 }),
    ]);
    await expect(client.getJson("/a.json")).rejects.toMatchObject({
      name: "CatalogError",
      kind: "rate_limited",
    });
    expect(await client.getJson("/a.json")).toEqual({ ok: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("ошибку в самом запросе не повторяет", async () => {
    const { client, fetchMock } = setup([json({}, 400)]);
    await expect(client.getJson("/a.json")).rejects.toBeInstanceOf(CatalogError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("не-JSON в ответе — ошибка формата", async () => {
    const { client } = setup([new Response("<html>", { status: 200 })]);
    await expect(client.getJson("/a.json")).rejects.toMatchObject({
      kind: "bad_response",
    });
  });
});

describe("MemoryCache", () => {
  it("вытесняет давно не читанные записи при переполнении", async () => {
    const cache = new MemoryCache({ maxEntries: 2 });
    await cache.set("a", 1, 1000);
    await cache.set("b", 2, 1000);
    await cache.get("a");
    await cache.set("c", 3, 1000);
    expect(await cache.get("a")).toBe(1);
    expect(await cache.get("b")).toBeUndefined();
    expect(cache.size).toBe(2);
  });

  it("не отдаёт просроченное", async () => {
    let now = 0;
    const cache = new MemoryCache({ now: () => now });
    await cache.set("a", 1, 100);
    now = 100;
    expect(await cache.get("a")).toBeUndefined();
    expect(cache.size).toBe(0);
  });
});

describe("ограничитель частоты", () => {
  it("разносит запросы на заданный интервал", async () => {
    let now = 1000;
    const delays: number[] = [];
    const waitTurn = createRateLimiter({
      minIntervalMs: 340,
      now: () => now,
      sleep: async (ms) => {
        delays.push(ms);
      },
    });
    await Promise.all([waitTurn(), waitTurn(), waitTurn()]);
    expect(delays).toEqual([340, 680]);

    now += 5000;
    await waitTurn();
    expect(delays).toHaveLength(2);
  });
});

describe("подсказка Google Books", () => {
  const suggestWith = (response: Response | Error) =>
    createGoogleBooksSuggest({
      fetch: (async () => {
        if (response instanceof Error) throw response;
        return response;
      }) as unknown as typeof fetch,
    });

  it("возвращает название и первого автора", async () => {
    const suggest = suggestWith(
      json({
        items: [
          { volumeInfo: { title: " Sapiens ", authors: ["Yuval Noah Harari", "X"] } },
        ],
      }),
    );
    expect(await suggest("sapeins")).toEqual({
      title: "Sapiens",
      author: "Yuval Noah Harari",
    });
  });

  it("любой сбой — просто нет подсказки", async () => {
    expect(await suggestWith(json({}, 429))("q")).toBeNull();
    expect(await suggestWith(json({}))("q")).toBeNull();
    expect(
      await suggestWith(json({ items: [{ volumeInfo: { title: 5 } }] }))("q"),
    ).toBeNull();
    expect(await suggestWith(new TypeError("fetch failed"))("q")).toBeNull();
  });
});

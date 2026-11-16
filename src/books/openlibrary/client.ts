import { CatalogError } from "@/books/types";
import { MemoryCache, type CacheStore } from "@/lib/cache";
import { createRateLimiter } from "@/lib/rate-limit";

/** Адрес каталога; в сценарных тестах подменяется локальной заглушкой. */
function baseUrl(): string {
  return (
    process.env.OPEN_LIBRARY_BASE_URL?.replace(/\/+$/, "") || "https://openlibrary.org"
  );
}
const REPOSITORY_URL = "https://github.com/Label777/AI-Book-Intelligence";

const DAY = 24 * 60 * 60 * 1000;
/** Срок хранения ответов каталога — 30 дней (docs/03-architecture.md, раздел о кэше). */
export const CATALOG_TTL_MS = 30 * DAY;
/** «Не найдено» помним недолго: запись в каталоге может появиться. */
export const NOT_FOUND_TTL_MS = DAY;

/** Open Library просит приложения представляться; для таких клиентов лимит — 3 запроса в секунду. */
export function userAgent(contact = process.env.OPEN_LIBRARY_CONTACT): string {
  const extra = contact?.trim() ? `; ${contact.trim()}` : "";
  return `AIBookIntelligence/0.1 (+${REPOSITORY_URL}${extra})`;
}

export interface CatalogClientOptions {
  cache?: CacheStore;
  fetch?: typeof fetch;
  /** Дождаться очереди перед запросом. */
  waitTurn?: () => Promise<void>;
  sleep?: (ms: number) => Promise<void>;
  /** Сколько раз повторить запрос после сбоя. */
  retries?: number;
  timeoutMs?: number;
}

/** Значение-метка для кэша: адрес проверен, записи там нет. */
const NOT_FOUND = { __notFound: true } as const;

function isNotFoundMarker(value: unknown): boolean {
  return typeof value === "object" && value !== null && "__notFound" in value;
}

function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds) && seconds > 0)
    return Math.min(seconds, 10) * 1000;
  // 0,5 с, 1 с, 2 с… плюс случайная добавка, чтобы повторы не шли залпом.
  return 500 * 2 ** attempt + Math.floor(Math.random() * 250);
}

export interface CatalogClient {
  /** JSON по пути каталога; null — если записи нет (404). Повторный вызов берётся из кэша. */
  getJson(path: string): Promise<unknown | null>;
}

export function createCatalogClient(options: CatalogClientOptions = {}): CatalogClient {
  const cache = options.cache ?? new MemoryCache();
  const doFetch = options.fetch ?? fetch;
  const waitTurn = options.waitTurn ?? createRateLimiter({ minIntervalMs: 340 });
  const sleep =
    options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 8000;
  // Одинаковые запросы, пришедшие одновременно, ждут один ответ.
  const inFlight = new Map<string, Promise<unknown | null>>();

  async function request(path: string): Promise<unknown | null> {
    let lastError: CatalogError | undefined;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      await waitTurn();
      let response: Response;
      try {
        response = await doFetch(`${baseUrl()}${path}`, {
          headers: { "User-Agent": userAgent(), Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          cache: "no-store",
        });
      } catch (cause) {
        lastError = new CatalogError("unavailable", "Каталог не ответил", { cause });
        if (attempt < retries) await sleep(retryDelayMs(attempt, null));
        continue;
      }

      if (response.status === 404) return null;
      if (response.ok) {
        try {
          return (await response.json()) as unknown;
        } catch (cause) {
          throw new CatalogError("bad_response", "Каталог вернул не JSON", { cause });
        }
      }
      if (response.status === 429 || response.status >= 500) {
        lastError = new CatalogError(
          response.status === 429 ? "rate_limited" : "unavailable",
          `Каталог ответил кодом ${response.status}`,
        );
        if (attempt < retries) {
          await sleep(retryDelayMs(attempt, response.headers.get("retry-after")));
        }
        continue;
      }
      // Остальные 4xx — ошибка в самом запросе, повтор не поможет.
      throw new CatalogError(
        "bad_response",
        `Каталог отклонил запрос: ${response.status}`,
      );
    }
    throw lastError ?? new CatalogError("unavailable", "Каталог не ответил");
  }

  return {
    async getJson(path) {
      const cached = await cache.get<unknown>(path);
      if (cached !== undefined) return isNotFoundMarker(cached) ? null : cached;

      const pending = inFlight.get(path);
      if (pending) return pending;

      const promise = request(path)
        .then(async (body) => {
          if (body === null) await cache.set(path, NOT_FOUND, NOT_FOUND_TTL_MS);
          else await cache.set(path, body, CATALOG_TTL_MS);
          return body;
        })
        .finally(() => inFlight.delete(path));
      inFlight.set(path, promise);
      return promise;
    },
  };
}

// Один клиент на процесс: общий кэш и общая очередь запросов.
const globalStore = globalThis as typeof globalThis & {
  __abiCatalogClient?: CatalogClient;
};

export function getCatalogClient(): CatalogClient {
  globalStore.__abiCatalogClient ??= createCatalogClient();
  return globalStore.__abiCatalogClient;
}

import { createGoogleBooksSuggest, type SuggestTitle } from "@/books/google-books";
import {
  CATALOG_TTL_MS,
  getCatalogCache,
  getCatalogClient,
  NOT_FOUND_TTL_MS,
  type CatalogClient,
} from "@/books/openlibrary/client";
import { parseSearchResponse } from "@/books/openlibrary/parse";
import { normalizeQuery } from "@/books/query";
import {
  assessConfidence,
  isGoodMatch,
  isStrongMatch,
  mergeDuplicates,
  rankCandidates,
} from "@/books/rank";
import {
  hasCyrillic,
  normalizeText,
  queryWords,
  tokenize,
  tokensEqual,
} from "@/books/text";
import type { BookCandidate, SearchOutcome, SearchStrategy } from "@/books/types";
import { createWikidataSuggest, firstSuggestion } from "@/books/wikidata";
import type { CacheStore } from "@/lib/cache";

const SEARCH_FIELDS = [
  "key",
  "title",
  "subtitle",
  "author_name",
  "first_publish_year",
  "edition_count",
  "cover_i",
  "language",
  "editions",
  "editions.title",
  "editions.language",
].join(",");

const CATALOG_LIMIT = 20;
/** Для ослабленных запросов берём больше: нужная книга может стоять не в начале. */
const RELAXED_LIMIT = 50;
export const RESULT_LIMIT = 10;
const MAX_RELAXED_QUERIES = 3;

/** Путь запроса к поиску Open Library. lang подсказывает, на каком языке показать название. */
export function searchPath(
  query: string,
  lang: "ru" | "en",
  limit = CATALOG_LIMIT,
): string {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    lang,
    fields: SEARCH_FIELDS,
  });
  return `/search.json?${params}`;
}

/** Запрос без кавычек и знаков препинания: у поиска каталога они имеют служебный смысл. */
export function catalogQuery(query: string): string {
  return query
    .replace(/[^\p{L}\p{N}\s'’-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Нечёткий запрос: «~» после слова разрешает каталогу одну-две опечатки в нём. */
export function fuzzyQuery(query: string): string | null {
  const words = queryWords(query);
  if (!words.some((word) => word.length >= 4)) return null;
  return words.map((word) => (word.length >= 4 ? `${word}~` : word)).join(" ");
}

/**
 * Ослабленные запросы: каталог ищет все слова сразу, и одно слово с опечаткой
 * («outliers gladwel») прячет нужную книгу. Убираем по одному слову — оставшиеся
 * находят книгу, а сравнение с полным запросом, терпимое к опечаткам, выбирает её.
 *
 * known — слова лучшего из уже найденных результатов: слово запроса, которого среди них
 * нет буква в букву, — первый кандидат на опечатку, его убираем раньше остальных.
 */
export function relaxedQueries(query: string, known: string[] = []): string[] {
  const words = queryWords(query);
  if (words.length < 2) return [];
  const suspect = (word: string) =>
    known.length > 0 &&
    !tokenize(word).some((token) => known.some((k) => tokensEqual(token, k)));
  const order = words
    .map((word, index) => ({ word, index, suspect: suspect(word) }))
    // Сначала подозрительные, затем длинные: в длинном слове опечатка вероятнее.
    .sort(
      (a, b) => Number(b.suspect) - Number(a.suspect) || b.word.length - a.word.length,
    )
    .slice(0, MAX_RELAXED_QUERIES);
  return order.map(({ index }) =>
    words.filter((_, position) => position !== index).join(" "),
  );
}

export interface SearchDeps {
  client?: CatalogClient;
  /** Подсказка исправленного или переведённого названия; null отключает запасные источники. */
  suggest?: SuggestTitle | null;
  /** Кэш готовых результатов; null отключает его. */
  cache?: CacheStore | null;
}

function defaultSuggest(): SuggestTitle {
  return firstSuggestion(createWikidataSuggest(), createGoogleBooksSuggest());
}

export async function searchBooks(
  rawQuery: string,
  deps: SearchDeps = {},
): Promise<SearchOutcome> {
  const query = normalizeQuery(rawQuery);
  const cleaned = catalogQuery(query);
  if (!cleaned) return { query, candidates: [], confidence: "low", strategy: "exact" };

  const cache = deps.cache === undefined ? getCatalogCache() : deps.cache;
  const cacheKey = `outcome:${normalizeText(cleaned)}`;
  const cached = await cache?.get<SearchOutcome>(cacheKey);
  if (cached) return { ...cached, query };

  const outcome = await runSearch(query, cleaned, deps);
  await cache?.set(
    cacheKey,
    outcome,
    outcome.candidates.length > 0 ? CATALOG_TTL_MS : NOT_FOUND_TTL_MS,
  );
  return outcome;
}

async function runSearch(
  query: string,
  cleaned: string,
  deps: SearchDeps,
): Promise<SearchOutcome> {
  const client = deps.client ?? getCatalogClient();
  const suggest = deps.suggest === undefined ? defaultSuggest() : deps.suggest;
  const lang = hasCyrillic(query) ? "ru" : "en";

  async function find(
    catalogText: string,
    limit?: number,
    language: "ru" | "en" = lang,
  ): Promise<BookCandidate[]> {
    const body = await client.getJson(searchPath(catalogText, language, limit));
    if (body === null) return [];
    return parseSearchResponse(body, language === "ru" ? "rus" : "eng").candidates;
  }

  let strategy: SearchStrategy = "exact";
  let correctedQuery: string | undefined;

  // 1. Запрос как есть. Оцениваем всегда по тому, что ввёл пользователь.
  let pool = await find(cleaned);
  let ranked = rankCandidates(mergeDuplicates(pool), query);

  // 2. Нет сильного совпадения — ослабляем запрос и выбираем лучшее из всего найденного.
  if (!isStrongMatch(ranked, query)) {
    const top = ranked[0];
    const known = top
      ? tokenize([top.title, top.subtitle ?? "", ...top.authors].join(" "))
      : [];
    const relaxed = relaxedQueries(cleaned, known);
    const tryVariant = async (variant: string) => {
      pool = [...pool, ...(await find(variant, RELAXED_LIMIT))];
      const next = rankCandidates(mergeDuplicates(pool), query);
      if (next[0] && next[0].workId !== ranked[0]?.workId) strategy = "fuzzy";
      ranked = next;
    };
    for (const variant of relaxed) {
      await tryVariant(variant);
      if (isStrongMatch(ranked, query)) break;
    }
    // Совсем ничего — просим каталог простить опечатки в словах.
    const fuzzy = pool.length === 0 ? fuzzyQuery(cleaned) : null;
    if (fuzzy) await tryVariant(fuzzy);
  }

  // 3. Всё ещё нет — спрашиваем исправленное или переведённое название у запасных источников.
  if (!isGoodMatch(ranked, query) && suggest) {
    const suggestion = await suggest(cleaned);
    if (suggestion) {
      const corrected = catalogQuery(
        [suggestion.title, suggestion.author ?? ""].join(" "),
      );
      if (corrected && normalizeText(corrected) !== normalizeText(cleaned)) {
        // Здесь оцениваем по исправленному запросу: с введённым результаты заведомо расходятся.
        const found = await find(
          corrected,
          undefined,
          hasCyrillic(corrected) ? "ru" : "en",
        );
        const fixed = rankCandidates(mergeDuplicates(found), corrected);
        if (isStrongMatch(fixed, corrected)) {
          ranked = fixed;
          strategy = "corrected";
          correctedQuery = corrected;
        }
      }
    }
  }

  const candidates = ranked.slice(0, RESULT_LIMIT);
  return {
    query,
    candidates,
    // После исправления запроса не делаем вид, что уверены: пусть пользователь подтвердит сам.
    confidence:
      strategy === "exact"
        ? assessConfidence(candidates)
        : candidates.length
          ? "medium"
          : "low",
    strategy,
    correctedQuery,
  };
}

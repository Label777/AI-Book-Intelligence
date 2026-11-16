import { createGoogleBooksSuggest, type SuggestTitle } from "@/books/google-books";
import { getCatalogClient, type CatalogClient } from "@/books/openlibrary/client";
import { parseSearchResponse } from "@/books/openlibrary/parse";
import { normalizeQuery } from "@/books/query";
import { assessConfidence, mergeDuplicates, rankCandidates } from "@/books/rank";
import { hasCyrillic, normalizeText } from "@/books/text";
import type {
  BookCandidate,
  RankedCandidate,
  SearchOutcome,
  SearchStrategy,
} from "@/books/types";

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
export const RESULT_LIMIT = 10;
/** Ниже этой оценки лучший результат считается слабым — пробуем исправить запрос. */
const WEAK_SCORE = 0.45;

/** Путь запроса к поиску Open Library. lang подсказывает, на каком языке показать название. */
export function searchPath(query: string, lang: "ru" | "en"): string {
  const params = new URLSearchParams({
    q: query,
    limit: String(CATALOG_LIMIT),
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
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (!words.some((word) => word.length >= 4)) return null;
  return words.map((word) => (word.length >= 4 ? `${word}~` : word)).join(" ");
}

export interface SearchDeps {
  client?: CatalogClient;
  /** Подсказка исправленного названия; null отключает запасной источник. */
  suggest?: SuggestTitle | null;
}

interface Attempt {
  ranked: RankedCandidate[];
  strategy: SearchStrategy;
  correctedQuery?: string;
}

function topScore(attempt: Attempt | undefined): number {
  return attempt?.ranked[0]?.score ?? 0;
}

export async function searchBooks(
  rawQuery: string,
  deps: SearchDeps = {},
): Promise<SearchOutcome> {
  const query = normalizeQuery(rawQuery);
  const empty: SearchOutcome = {
    query,
    candidates: [],
    confidence: "low",
    strategy: "exact",
  };
  const cleaned = catalogQuery(query);
  if (!cleaned) return empty;

  const client = deps.client ?? getCatalogClient();
  const suggest = deps.suggest === undefined ? createGoogleBooksSuggest() : deps.suggest;
  const lang = hasCyrillic(query) ? "ru" : "en";

  async function find(catalogText: string): Promise<BookCandidate[]> {
    const body = await client.getJson(searchPath(catalogText, lang));
    return body === null ? [] : mergeDuplicates(parseSearchResponse(body).candidates);
  }

  // 1. Запрос как есть. Оцениваем всегда по тому, что ввёл пользователь.
  let best: Attempt = {
    ranked: rankCandidates(await find(cleaned), query),
    strategy: "exact",
  };

  // 2. Ничего или слабо — разрешаем каталогу опечатки.
  if (topScore(best) < WEAK_SCORE) {
    const fuzzy = fuzzyQuery(cleaned);
    if (fuzzy) {
      const ranked = rankCandidates(await find(fuzzy), query);
      if (topScore({ ranked, strategy: "fuzzy" }) > topScore(best)) {
        best = { ranked, strategy: "fuzzy" };
      }
    }
  }

  // 3. Всё ещё слабо — спрашиваем исправленное название у запасного источника.
  if (topScore(best) < WEAK_SCORE && suggest) {
    const suggestion = await suggest(cleaned);
    if (suggestion) {
      const corrected = catalogQuery(
        [suggestion.title, suggestion.author ?? ""].join(" "),
      );
      if (corrected && normalizeText(corrected) !== normalizeText(cleaned)) {
        // Здесь оцениваем по исправленному запросу: с введённым результаты заведомо расходятся.
        const ranked = rankCandidates(await find(corrected), corrected);
        if (
          ranked.length > 0 &&
          topScore({ ranked, strategy: "corrected" }) > topScore(best)
        ) {
          best = { ranked, strategy: "corrected", correctedQuery: corrected };
        }
      }
    }
  }

  const candidates = best.ranked.slice(0, RESULT_LIMIT);
  return {
    query,
    candidates,
    // После исправления запроса не делаем вид, что уверены: пусть пользователь подтвердит сам.
    confidence:
      best.strategy === "exact"
        ? assessConfidence(candidates)
        : candidates.length
          ? "medium"
          : "low",
    strategy: best.strategy,
    correctedQuery: best.correctedQuery,
  };
}

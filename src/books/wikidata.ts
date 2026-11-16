import type { SuggestTitle, TitleSuggestion } from "@/books/google-books";
import { hasCyrillic, normalizeText } from "@/books/text";

/**
 * Wikidata как переводчик названий: в Open Library мало русских изданий, и запрос
 * «Атомные привычки» там ничего не находит. В Wikidata у известных книг есть название
 * на многих языках — берём английское название и автора и повторяем поиск с ними.
 */

const API = "https://www.wikidata.org/w/api.php";
const USER_AGENT =
  "AIBookIntelligence/0.1 (+https://github.com/Label777/AI-Book-Intelligence)";

interface Options {
  fetch?: typeof fetch;
  timeoutMs?: number;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Запрос и его укороченные варианты: «Чёрный лебедь Талеб» → без последнего слова → без первого. */
export function searchVariants(query: string): string[] {
  const words = normalizeText(query).split(" ").filter(Boolean);
  const variants = [words.join(" ")];
  if (words.length >= 3) {
    variants.push(words.slice(0, -1).join(" "), words.slice(1).join(" "));
  }
  return [...new Set(variants)];
}

function label(entity: unknown, language: string): string | undefined {
  if (!isObject(entity) || !isObject(entity.labels)) return undefined;
  const entry = entity.labels[language];
  return isObject(entry) && typeof entry.value === "string" && entry.value.trim()
    ? entry.value.trim()
    : undefined;
}

/** Идентификаторы авторов из утверждения P50 («автор»). */
function authorIds(entity: unknown): string[] {
  if (!isObject(entity) || !isObject(entity.claims) || !Array.isArray(entity.claims.P50))
    return [];
  const ids: string[] = [];
  for (const claim of entity.claims.P50) {
    const value =
      isObject(claim) && isObject(claim.mainsnak) && isObject(claim.mainsnak.datavalue)
        ? claim.mainsnak.datavalue.value
        : undefined;
    if (isObject(value) && typeof value.id === "string" && /^Q\d+$/.test(value.id))
      ids.push(value.id);
  }
  return ids;
}

export function createWikidataSuggest(options: Options = {}): SuggestTitle {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  async function call(params: Record<string, string>): Promise<Json | null> {
    const base = process.env.WIKIDATA_BASE_URL?.replace(/\/+$/, "");
    const url = `${base ? `${base}/w/api.php` : API}?${new URLSearchParams({ ...params, format: "json" })}`;
    const response = await doFetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    return isObject(body) ? body : null;
  }

  return async function suggestTitle(query): Promise<TitleSuggestion | null> {
    const language = hasCyrillic(query) ? "ru" : "en";
    try {
      for (const variant of searchVariants(query)) {
        const found = await call({
          action: "wbsearchentities",
          search: variant,
          language,
          uselang: language,
          type: "item",
          limit: "5",
        });
        const ids = (Array.isArray(found?.search) ? found.search : [])
          .flatMap((item) =>
            isObject(item) && typeof item.id === "string" ? item.id : [],
          )
          .filter((id) => /^Q\d+$/.test(id));
        if (ids.length === 0) continue;

        const details = await call({
          action: "wbgetentities",
          ids: ids.join("|"),
          props: "labels|claims",
          languages: "en",
        });
        if (!isObject(details?.entities)) continue;

        // Первая сущность с автором и английским названием — это книга, а не человек или фильм.
        for (const id of ids) {
          const entity = details.entities[id];
          const title = label(entity, "en");
          const [authorId] = authorIds(entity);
          if (!title || !authorId) continue;

          const authorDetails = await call({
            action: "wbgetentities",
            ids: authorId,
            props: "labels",
            languages: "en",
          });
          const author = isObject(authorDetails?.entities)
            ? label(authorDetails.entities[authorId], "en")
            : undefined;
          return { title, author };
        }
      }
      return null;
    } catch {
      // Запасной источник не должен ломать поиск.
      return null;
    }
  };
}

/** Спрашивает источники по очереди, пока один не даст подсказку. */
export function firstSuggestion(...sources: SuggestTitle[]): SuggestTitle {
  return async (query) => {
    for (const source of sources) {
      const suggestion = await source(query);
      if (suggestion) return suggestion;
    }
    return null;
  };
}

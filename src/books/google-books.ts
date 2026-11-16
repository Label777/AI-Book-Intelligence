/**
 * Google Books как запасной вариант: его поиск прощает опечатки, поэтому
 * мы берём у него исправленные название и автора и повторяем поиск в Open Library.
 * Сами данные о книге по-прежнему приходят из Open Library.
 */

export interface TitleSuggestion {
  title: string;
  author?: string;
}

export type SuggestTitle = (query: string) => Promise<TitleSuggestion | null>;

interface SuggestOptions {
  fetch?: typeof fetch;
  apiKey?: string;
  timeoutMs?: number;
}

export function createGoogleBooksSuggest(options: SuggestOptions = {}): SuggestTitle {
  const doFetch = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? 5000;

  return async function suggestTitle(query) {
    const params = new URLSearchParams({
      q: query,
      maxResults: "1",
      printType: "books",
      fields: "items(volumeInfo(title,authors))",
    });
    const apiKey = options.apiKey ?? process.env.GOOGLE_BOOKS_API_KEY;
    if (apiKey) params.set("key", apiKey);

    try {
      const base =
        (
          process.env.GOOGLE_BOOKS_BASE_URL ||
          process.env.NEXT_PUBLIC_GOOGLE_BOOKS_BASE_URL
        )?.replace(/\/+$/, "") || "https://www.googleapis.com";
      const response = await doFetch(`${base}/books/v1/volumes?${params}`, {
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (!response.ok) return null;
      const body = (await response.json()) as {
        items?: { volumeInfo?: { title?: unknown; authors?: unknown } }[];
      };
      const info = body.items?.[0]?.volumeInfo;
      if (typeof info?.title !== "string" || !info.title.trim()) return null;
      const author = Array.isArray(info.authors) ? info.authors[0] : undefined;
      return {
        title: info.title.trim(),
        author: typeof author === "string" && author.trim() ? author.trim() : undefined,
      };
    } catch {
      // Запасной источник не должен ломать поиск: нет ответа — нет подсказки.
      return null;
    }
  };
}

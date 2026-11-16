/**
 * Адреса страниц. У сайта две сборки: серверная (книга по адресу /book/OL1W) и статическая
 * для GitHub Pages, где страницы с произвольным адресом невозможны, — там /book/?id=OL1W.
 */
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";

export interface BookPageState {
  /** Поисковый запрос, с которого пришли, — чтобы вернуться к результатам. */
  q?: string;
  lang?: string;
  edition?: string;
}

/** Страница книги с сохранением запроса, фильтра языка и выбранного издания. */
export function bookHref(workId: string, state: BookPageState = {}): string {
  const params = new URLSearchParams();
  if (STATIC_SITE) params.set("id", workId);
  if (state.q) params.set("q", state.q);
  if (state.lang) params.set("lang", state.lang);
  if (state.edition) params.set("edition", state.edition);
  const query = params.toString();
  return `${STATIC_SITE ? "/book" : `/book/${workId}`}${query ? `?${query}` : ""}`;
}

export function searchHref(query: string): string {
  return `/search?${new URLSearchParams({ q: query })}`;
}

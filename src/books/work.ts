import { normalizeAuthors } from "@/books/authors";
import { getCatalogClient, type CatalogClient } from "@/books/openlibrary/client";
import {
  parseAuthorName,
  parseEditions,
  parseSearchResponse,
  parseWork,
} from "@/books/openlibrary/parse";
import type { BookDetails, Edition } from "@/books/types";

export const EDITIONS_PAGE_SIZE = 100;
const MAX_AUTHORS = 5;

/** Идентификатор произведения Open Library: OL + цифры + W. Всё остальное в адресе — не книга. */
export function isWorkId(value: string): boolean {
  return /^OL\d{1,12}W$/.test(value);
}

export function isEditionId(value: string): boolean {
  return /^OL\d{1,12}M$/.test(value);
}

/** Сначала издания с известным годом (новые выше), затем остальные по названию. */
export function sortEditions(editions: Edition[]): Edition[] {
  return [...editions].sort((a, b) => {
    if (a.year !== b.year) return (b.year ?? -Infinity) - (a.year ?? -Infinity);
    return a.title.localeCompare(b.title, "ru");
  });
}

/**
 * Год первой публикации и число изданий надёжнее всего знает поисковый индекс каталога.
 * Это дополнение: если запрос не удался, страница обходится данными об изданиях.
 */
async function workSummary(client: CatalogClient, workId: string) {
  try {
    const params = new URLSearchParams({
      q: `key:/works/${workId}`,
      fields: "key,title,first_publish_year,edition_count",
      limit: "1",
    });
    const body = await client.getJson(`/search.json?${params}`);
    if (body === null) return undefined;
    return parseSearchResponse(body).candidates.find((item) => item.workId === workId);
  } catch {
    return undefined;
  }
}

/** Произведение с авторами и первой страницей изданий; null — если такого произведения нет. */
export async function getBook(
  workId: string,
  client: CatalogClient = getCatalogClient(),
): Promise<BookDetails | null> {
  if (!isWorkId(workId)) return null;

  const [workBody, editionsBody, summary] = await Promise.all([
    client.getJson(`/works/${workId}.json`),
    client.getJson(`/works/${workId}/editions.json?limit=${EDITIONS_PAGE_SIZE}`),
    workSummary(client, workId),
  ]);
  if (workBody === null) return null;

  const work = parseWork(workBody);
  const { editions, total } =
    editionsBody === null ? { editions: [], total: 0 } : parseEditions(editionsBody);

  // Имена авторов лежат в отдельных записях. Сбой одной из них не должен ронять страницу.
  const names = await Promise.all(
    work.authorIds.slice(0, MAX_AUTHORS).map(async (authorId) => {
      try {
        return parseAuthorName(await client.getJson(`/authors/${authorId}.json`));
      } catch {
        return undefined;
      }
    }),
  );

  // По изданиям год первой публикации виден, только если загружены все издания.
  const years =
    editions.length >= total ? editions.flatMap((edition) => edition.year ?? []) : [];
  return {
    workId: work.workId,
    title: work.title,
    subtitle: work.subtitle,
    authors: normalizeAuthors(names.flatMap((name) => name ?? [])),
    description: work.description,
    firstPublishYear:
      summary?.firstPublishYear ??
      work.firstPublishYear ??
      (years.length ? Math.min(...years) : undefined),
    coverUrl: work.coverUrl ?? editions.find((edition) => edition.coverUrl)?.coverUrl,
    subjects: work.subjects,
    editions: sortEditions(editions),
    editionTotal: Math.max(total, editions.length, summary?.editionCount ?? 0),
  };
}

import { normalizeAuthors } from "@/books/authors";
import { CatalogError, type BookCandidate, type Edition } from "@/books/types";

/*
 * Разбор ответов Open Library. Каталог наполняют добровольцы, поэтому любое поле
 * может отсутствовать или иметь неожиданный тип: читаем только то, что проверили.
 */

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => asString(item) ?? []);
}

function asPositiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

/** «/works/OL17075811W» → «OL17075811W». */
export function idFromKey(key: unknown, suffix: "W" | "M" | "A"): string | undefined {
  const match = new RegExp(`(OL\\d+${suffix})$`).exec(asString(key) ?? "");
  return match?.[1];
}

export function coverUrl(
  coverId: unknown,
  size: "S" | "M" | "L" = "M",
): string | undefined {
  const id = asPositiveInt(coverId);
  return id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : undefined;
}

function firstCover(value: unknown): string | undefined {
  if (!Array.isArray(value)) return undefined;
  return coverUrl(value.find((item) => asPositiveInt(item)));
}

/** Год из строки вида «2015», «March 2015» или «2015-03-01». */
export function parseYear(value: unknown): number | undefined {
  const text = typeof value === "number" ? String(value) : asString(value);
  const match = /(?<!\d)(1[0-9]{3}|20[0-9]{2})(?!\d)/.exec(text ?? "");
  return match ? Number(match[1]) : undefined;
}

/** Описание бывает строкой или объектом { type, value }. */
function textValue(value: unknown): string | undefined {
  if (isObject(value)) return asString(value.value);
  return asString(value);
}

/** Убирает разметку и служебные хвосты из описания, которое пишут пользователи каталога. */
export function cleanDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/\r\n?/g, "\n")
    // Часто после разделителя идут ссылки на источник описания и список изданий.
    .split(
      /\n\s*(?:-{4,}|\(\[source\]|\[source\]|\*\*(?:Contains|Also contained in|Source)\b)/i,
    )[0]
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\[([^\]]+)\]\((?:https?:)?[^)]*\)/g, "$1")
    .replace(/^\s*\[\d+\]:\s*\S+.*$/gm, "")
    .replace(/[*_]{1,3}([^*_\n]+)[*_]{1,3}/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || undefined;
}

export interface SearchPage {
  total: number;
  candidates: BookCandidate[];
}

export function parseSearchResponse(body: unknown): SearchPage {
  if (!isObject(body) || !Array.isArray(body.docs)) {
    throw new CatalogError("bad_response", "В ответе поиска нет списка docs");
  }
  const candidates: BookCandidate[] = [];
  for (const doc of body.docs) {
    if (!isObject(doc)) continue;
    const workId = idFromKey(doc.key, "W");
    const workTitle = asString(doc.title);
    if (!workId || !workTitle) continue;

    // Если каталог подобрал издание на языке запроса, показываем его название.
    let editionTitle: string | undefined;
    if (isObject(doc.editions) && Array.isArray(doc.editions.docs)) {
      const edition = doc.editions.docs.find(isObject);
      editionTitle = edition ? asString(edition.title) : undefined;
    }

    candidates.push({
      workId,
      title: editionTitle ?? workTitle,
      subtitle:
        editionTitle && editionTitle !== workTitle ? workTitle : asString(doc.subtitle),
      authors: normalizeAuthors(asStrings(doc.author_name)),
      firstPublishYear: parseYear(doc.first_publish_year),
      editionCount: asPositiveInt(doc.edition_count),
      coverUrl: coverUrl(doc.cover_i),
      languages: asStrings(doc.language),
    });
  }
  const total = typeof body.numFound === "number" ? body.numFound : candidates.length;
  return { total, candidates };
}

export interface ParsedWork {
  workId: string;
  title: string;
  subtitle?: string;
  description?: string;
  authorIds: string[];
  coverUrl?: string;
  subjects: string[];
  firstPublishYear?: number;
}

/** Темы каталога замусорены служебными метками — оставляем похожие на обычные слова. */
function cleanSubjects(raw: string[], limit = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const subject of raw) {
    if (subject.length > 40 || /[:=/\d]|--/.test(subject)) continue;
    const key = subject.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(subject);
    if (result.length >= limit) break;
  }
  return result;
}

export function parseWork(body: unknown): ParsedWork {
  if (!isObject(body))
    throw new CatalogError("bad_response", "Ответ о произведении не объект");
  const workId = idFromKey(body.key, "W");
  const title = asString(body.title);
  if (!workId || !title) {
    throw new CatalogError(
      "bad_response",
      "В ответе о произведении нет ключа или названия",
    );
  }
  const authorIds: string[] = [];
  if (Array.isArray(body.authors)) {
    for (const entry of body.authors) {
      if (!isObject(entry)) continue;
      // Обычно { author: { key } }, в старых записях — сразу { key }.
      const key = isObject(entry.author) ? entry.author.key : (entry.author ?? entry.key);
      const id = idFromKey(key, "A");
      if (id && !authorIds.includes(id)) authorIds.push(id);
    }
  }
  return {
    workId,
    title,
    subtitle: asString(body.subtitle),
    description: cleanDescription(textValue(body.description)),
    authorIds,
    coverUrl: firstCover(body.covers),
    subjects: cleanSubjects(asStrings(body.subjects)),
    firstPublishYear: parseYear(body.first_publish_date),
  };
}

export function parseAuthorName(body: unknown): string | undefined {
  if (!isObject(body)) return undefined;
  return asString(body.name) ?? asString(body.personal_name);
}

export interface EditionsPage {
  total: number;
  editions: Edition[];
}

export function parseEditions(body: unknown): EditionsPage {
  if (!isObject(body) || !Array.isArray(body.entries)) {
    throw new CatalogError("bad_response", "В ответе об изданиях нет списка entries");
  }
  const editions: Edition[] = [];
  for (const entry of body.entries) {
    if (!isObject(entry)) continue;
    const id = idFromKey(entry.key, "M");
    const title = asString(entry.title);
    if (!id || !title) continue;

    const languages: string[] = [];
    if (Array.isArray(entry.languages)) {
      for (const language of entry.languages) {
        const code = isObject(language)
          ? /([a-z]{3})$/.exec(asString(language.key) ?? "")?.[1]
          : undefined;
        if (code && !languages.includes(code)) languages.push(code);
      }
    }

    editions.push({
      id,
      title,
      subtitle: asString(entry.subtitle),
      publishers: asStrings(entry.publishers).slice(0, 2),
      year: parseYear(entry.publish_date),
      languages,
      isbn: asStrings(entry.isbn_13)[0] ?? asStrings(entry.isbn_10)[0],
      pages: asPositiveInt(entry.number_of_pages),
      coverUrl: firstCover(entry.covers),
    });
  }
  const total = typeof body.size === "number" ? body.size : editions.length;
  return { total, editions };
}

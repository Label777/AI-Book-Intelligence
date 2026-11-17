import { getCatalogClient, type CatalogClient } from "@/books/openlibrary/client";
import { coverage, hasCyrillic, tokenize, tokensMatch } from "@/books/text";

/*
 * Десять открытых библиотек, подключённых к сайту. Все бесплатны и легальны: общественное
 * достояние, открытые лицензии или выдача с согласия правообладателей.
 *
 * Подключение двух видов:
 *  • check  — у библиотеки есть открытый программный доступ, сайт сам проверяет,
 *             есть ли там именно эта книга, и даёт прямую ссылку;
 *  • search — программного доступа из браузера нет, сайт даёт ссылку на поиск
 *             этой книги в библиотеке.
 */

export interface BookRef {
  workId: string;
  title: string;
  authors: string[];
}

export interface Library {
  id: string;
  name: string;
  /** Что это за библиотека — одной строкой. */
  about: string;
  connection: "check" | "search";
  /** Адрес поиска книги в этой библиотеке. */
  searchUrl: (book: BookRef) => string;
}

const text = (book: BookRef) => [book.title, book.authors[0] ?? ""].join(" ").trim();
const q = (value: string) => encodeURIComponent(value);

/** Раздел Викитеки по языку названия: украинский, русский или английский. */
export function wikisourceLanguage(title: string): "uk" | "ru" | "en" {
  if (/[іїєґ]/i.test(title)) return "uk";
  return hasCyrillic(title) ? "ru" : "en";
}

export const LIBRARIES: Library[] = [
  {
    id: "openlibrary",
    name: "Open Library",
    about: "Каталог всех книг мира; часть можно взять почитать на время.",
    connection: "check",
    searchUrl: (book) => `https://openlibrary.org/works/${book.workId}`,
  },
  {
    id: "archive",
    name: "Internet Archive",
    about: "Миллионы отсканированных книг, свободных для чтения.",
    connection: "check",
    searchUrl: (book) =>
      `https://archive.org/search?query=${q(text(book))}&and[]=mediatype%3A%22texts%22`,
  },
  {
    id: "gutenberg",
    name: "Project Gutenberg",
    about: "Классика в общественном достоянии: EPUB, Kindle, чтение онлайн.",
    connection: "check",
    searchUrl: (book) =>
      `https://www.gutenberg.org/ebooks/search/?query=${q(text(book))}`,
  },
  {
    id: "google",
    name: "Google Books",
    about: "Полные тексты старых книг и фрагменты современных.",
    connection: "check",
    searchUrl: (book) => `https://www.google.com/search?tbm=bks&q=${q(text(book))}`,
  },
  {
    id: "standardebooks",
    name: "Standard Ebooks",
    about: "Тщательно свёрстанные издания классики на английском.",
    connection: "search",
    searchUrl: (book) => `https://standardebooks.org/ebooks?query=${q(text(book))}`,
  },
  {
    id: "librivox",
    name: "LibriVox",
    about: "Бесплатные аудиокниги, начитанные добровольцами.",
    connection: "search",
    searchUrl: (book) =>
      `https://librivox.org/search?q=${q(book.title)}&search_form=advanced`,
  },
  {
    id: "wikisource",
    name: "Викитека",
    about: "Свободные тексты на украинском, русском, английском и других языках.",
    connection: "search",
    searchUrl: (book) =>
      `https://${wikisourceLanguage(book.title)}.wikisource.org/w/index.php?search=${q(text(book))}`,
  },
  {
    id: "hathitrust",
    name: "HathiTrust",
    about: "Оцифрованные фонды университетских библиотек.",
    connection: "search",
    searchUrl: (book) =>
      `https://catalog.hathitrust.org/Search/Home?lookfor=${q(text(book))}&type=all`,
  },
  {
    id: "doab",
    name: "DOAB",
    about: "Научные книги в открытом доступе от академических издательств.",
    connection: "search",
    searchUrl: (book) => `https://directory.doabooks.org/discover?query=${q(text(book))}`,
  },
  {
    id: "europeana",
    name: "Europeana",
    about: "Оцифрованные книги из библиотек и архивов Европы.",
    connection: "search",
    searchUrl: (book) => `https://www.europeana.eu/en/search?query=${q(text(book))}`,
  },
];

export type AccessKind = "read" | "borrow" | "preview";

/** Найденная в библиотеке книга: прямая ссылка и что по ней доступно. */
export interface FoundAccess {
  libraryId: string;
  kind: AccessKind;
  url: string;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

/** Та же ли это книга: названия совпадают по словам в обе стороны, фамилия автора — тоже. */
export function isSameBook(book: BookRef, title: string, authors: string[]): boolean {
  const wanted = tokenize(book.title);
  const got = tokenize(title.split(/[:;(]/)[0]);
  if (wanted.length === 0 || got.length === 0) return false;
  if (coverage(wanted, got) < 1 || coverage(got, wanted) < 0.6) return false;
  if (book.authors.length === 0) return true;
  const wantedAuthor = tokenize(book.authors.join(" "));
  const gotAuthor = tokenize(authors.join(" "));
  // Достаточно одного общего слова длиной от трёх букв: «Austen, Jane» ↔ «Jane Austen».
  return wantedAuthor.some(
    (a) => a.length >= 3 && gotAuthor.some((b) => b.length >= 3 && tokensMatch(a, b)),
  );
}

/** Open Library и Internet Archive: есть ли электронная копия произведения. */
export function parseOpenLibraryAccess(body: unknown, book: BookRef): FoundAccess[] {
  if (!isObject(body) || !Array.isArray(body.docs)) return [];
  const doc = body.docs.find(
    (item): item is Json => isObject(item) && item.key === `/works/${book.workId}`,
  );
  if (!doc) return [];
  const scan = strings(doc.ia).find((id) => /^[\w.-]+$/.test(id));
  if (doc.ebook_access === "public" && scan) {
    return [
      { libraryId: "archive", kind: "read", url: `https://archive.org/details/${scan}` },
    ];
  }
  if (doc.ebook_access === "borrowable") {
    return [
      {
        libraryId: "openlibrary",
        kind: "borrow",
        url: `https://openlibrary.org/works/${book.workId}`,
      },
    ];
  }
  return [];
}

/** Project Gutenberg (через каталог Gutendex). */
export function parseGutenbergAccess(body: unknown, book: BookRef): FoundAccess[] {
  if (!isObject(body) || !Array.isArray(body.results)) return [];
  for (const item of body.results) {
    if (!isObject(item) || typeof item.title !== "string") continue;
    const id = typeof item.id === "number" && Number.isInteger(item.id) ? item.id : null;
    const authors = Array.isArray(item.authors)
      ? item.authors.flatMap((a) =>
          isObject(a) && typeof a.name === "string" ? a.name : [],
        )
      : [];
    if (id && isSameBook(book, item.title, authors)) {
      return [
        {
          libraryId: "gutenberg",
          kind: "read",
          url: `https://www.gutenberg.org/ebooks/${id}`,
        },
      ];
    }
  }
  return [];
}

/** Google Books: полный текст или фрагмент. */
export function parseGoogleAccess(body: unknown, book: BookRef): FoundAccess[] {
  if (!isObject(body) || !Array.isArray(body.items)) return [];
  let preview: FoundAccess | undefined;
  for (const item of body.items) {
    if (!isObject(item) || !isObject(item.volumeInfo) || !isObject(item.accessInfo))
      continue;
    const info = item.volumeInfo;
    const url =
      typeof info.previewLink === "string"
        ? info.previewLink.replace(/^http:/, "https:")
        : "";
    if (
      typeof info.title !== "string" ||
      !/^https:\/\/[\w.-]*google\.[a-z.]+\//.test(url)
    )
      continue;
    if (!isSameBook(book, info.title, strings(info.authors))) continue;
    const view = item.accessInfo.viewability;
    if (view === "ALL_PAGES") return [{ libraryId: "google", kind: "read", url }];
    if (view === "PARTIAL") preview ??= { libraryId: "google", kind: "preview", url };
  }
  return preview ? [preview] : [];
}

export interface AccessDeps {
  client?: CatalogClient;
  fetch?: typeof fetch;
}

async function getJson(doFetch: typeof fetch, url: string): Promise<unknown> {
  const response = await doFetch(url, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as unknown;
}

/**
 * Проверяет наличие книги в библиотеках с программным доступом. Каждая проверка независима:
 * если библиотека не ответила, по ней просто нет результата — остаётся ссылка на поиск.
 */
export async function findAccess(
  book: BookRef,
  deps: AccessDeps = {},
): Promise<FoundAccess[]> {
  const doFetch = deps.fetch ?? fetch;
  const author = book.authors[0] ?? "";
  // Имена переменных написаны полностью: сборщик подставляет NEXT_PUBLIC_* по точному имени.
  const gutendex = (
    process.env.NEXT_PUBLIC_GUTENDEX_BASE_URL || "https://gutendex.com"
  ).replace(/\/+$/, "");
  const google = (
    process.env.NEXT_PUBLIC_GOOGLE_BOOKS_BASE_URL || "https://www.googleapis.com"
  ).replace(/\/+$/, "");

  const checks: Promise<FoundAccess[]>[] = [
    (async () => {
      const params = new URLSearchParams({
        q: `key:/works/${book.workId}`,
        fields: "key,ebook_access,ia",
        limit: "1",
      });
      const client = deps.client ?? getCatalogClient();
      return parseOpenLibraryAccess(await client.getJson(`/search.json?${params}`), book);
    })(),
    (async () => {
      const params = new URLSearchParams({ search: text(book) });
      return parseGutenbergAccess(
        await getJson(doFetch, `${gutendex}/books?${params}`),
        book,
      );
    })(),
    (async () => {
      const params = new URLSearchParams({
        q: `intitle:"${book.title}"${author ? ` inauthor:"${author}"` : ""}`,
        maxResults: "5",
        printType: "books",
        fields: "items(volumeInfo(title,authors,previewLink),accessInfo(viewability))",
      });
      return parseGoogleAccess(
        await getJson(doFetch, `${google}/books/v1/volumes?${params}`),
        book,
      );
    })(),
  ];

  const settled = await Promise.allSettled(checks);
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

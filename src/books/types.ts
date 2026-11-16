/** Кандидат в результатах поиска — произведение, а не отдельное издание. */
export interface BookCandidate {
  /** Идентификатор произведения в Open Library, например OL17075811W. */
  workId: string;
  title: string;
  subtitle?: string;
  authors: string[];
  firstPublishYear?: number;
  editionCount?: number;
  coverUrl?: string;
  /** Коды языков изданий (ISO 639-2: eng, rus…). */
  languages: string[];
}

export interface RankedCandidate extends BookCandidate {
  /** Оценка соответствия запросу, 0–1. */
  score: number;
  /** Какая доля слов запроса нашлась в названии и авторах, 0–1. */
  matched: number;
}

export type Confidence = "high" | "medium" | "low";

/**
 * Как был получен результат: по запросу как есть, по ослабленному запросу (часть слов
 * с опечатками) или по названию, исправленному или переведённому запасным источником.
 */
export type SearchStrategy = "exact" | "fuzzy" | "corrected";

export interface SearchOutcome {
  query: string;
  candidates: RankedCandidate[];
  confidence: Confidence;
  strategy: SearchStrategy;
  /** Запрос, по которому найдены результаты, если он отличается от введённого. */
  correctedQuery?: string;
}

export interface Edition {
  /** Идентификатор издания в Open Library, например OL27213498M. */
  id: string;
  title: string;
  subtitle?: string;
  publishers: string[];
  year?: number;
  languages: string[];
  isbn?: string;
  pages?: number;
  coverUrl?: string;
}

export interface BookDetails {
  workId: string;
  title: string;
  subtitle?: string;
  authors: string[];
  description?: string;
  firstPublishYear?: number;
  coverUrl?: string;
  subjects: string[];
  editions: Edition[];
  /** Сколько изданий всего в каталоге (в editions — только первая страница). */
  editionTotal: number;
}

export type CatalogErrorKind = "unavailable" | "rate_limited" | "bad_response";

/** Каталог не ответил или ответил не тем, что ожидалось. */
export class CatalogError extends Error {
  readonly kind: CatalogErrorKind;

  constructor(kind: CatalogErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CatalogError";
    this.kind = kind;
  }
}

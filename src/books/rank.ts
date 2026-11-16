import { coverage, normalizeText, tokenize } from "@/books/text";
import type { BookCandidate, Confidence, RankedCandidate } from "@/books/types";

/** Пересказы, конспекты и рабочие тетради по чужой книге: в каталоге их много, а ищут обычно оригинал. */
const DERIVATIVE_MARKERS = [
  "summary of",
  "summary and analysis",
  "summary analysis",
  "summary",
  "study guide",
  "workbook",
  "key takeaways",
  "key insights",
  "conversation starters",
  "book review",
  "in 30 minutes",
  "instaread",
  "sparknotes",
  "cliffsnotes",
  "a guide to the book",
  "краткое содержание",
  "саммари",
];

export function isDerivative(title: string): boolean {
  const normalized = ` ${normalizeText(title)} `;
  return DERIVATIVE_MARKERS.some((marker) => normalized.includes(` ${marker} `));
}

/**
 * Объединяет записи одного произведения, заведённые в каталоге дважды:
 * одинаковое название и первый автор. Остаётся запись с большим числом изданий.
 */
export function mergeDuplicates(candidates: BookCandidate[]): BookCandidate[] {
  const byKey = new Map<string, BookCandidate>();
  for (const candidate of candidates) {
    const author = normalizeText(candidate.authors[0] ?? "")
      .split(" ")
      .sort()
      .join(" ");
    const key = `${normalizeText(candidate.title)}|${author}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
    } else if ((candidate.editionCount ?? 0) > (existing.editionCount ?? 0)) {
      // Порядок в выдаче сохраняем за первой встреченной записью.
      byKey.set(key, { ...candidate, coverUrl: candidate.coverUrl ?? existing.coverUrl });
    } else if (!existing.coverUrl && candidate.coverUrl) {
      byKey.set(key, { ...existing, coverUrl: candidate.coverUrl });
    }
  }
  return [...byKey.values()];
}

/** Популярность по числу изданий: 1 издание → 0,13; 20 → 0,57; 200 и больше → 1. */
function popularity(editionCount: number | undefined): number {
  return Math.min(1, Math.log10(1 + (editionCount ?? 1)) / 2.3);
}

export function scoreCandidate(
  candidate: BookCandidate,
  query: string,
  position: number,
  total: number,
): number {
  const queryTokens = tokenize(query);
  const titleTokens = tokenize([candidate.title, candidate.subtitle ?? ""].join(" "));
  const mainTitleTokens = tokenize(candidate.title);
  const authorTokens = tokenize(candidate.authors.join(" "));

  // Насколько запрос объясняется названием и автором…
  const queryCovered = coverage(queryTokens, [...titleTokens, ...authorTokens]);
  // …и насколько название объясняется запросом: «Сапиенс» ближе к запросу «сапиенс»,
  // чем «Краткое содержание книги „Сапиенс“ за 30 минут».
  const titleCovered = coverage(mainTitleTokens, queryTokens);
  // Порядок каталога учитывает то, чего мы не видим (другие названия, текст изданий).
  const catalogOrder = total > 1 ? 1 - position / (total - 1) : 1;

  let score =
    0.45 * queryCovered +
    0.2 * titleCovered +
    0.2 * popularity(candidate.editionCount) +
    0.15 * catalogOrder;

  // Пересказ опускаем, если искали не его; если искали именно пересказ — поднимаем.
  if (isDerivative(candidate.title)) score += isDerivative(query) ? 0.25 : -0.35;
  return Math.max(0, Math.min(1, score));
}

export function rankCandidates(
  candidates: BookCandidate[],
  query: string,
): RankedCandidate[] {
  return candidates
    .map((candidate, index) => ({
      ...candidate,
      score: scoreCandidate(candidate, query, index, candidates.length),
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Насколько мы уверены, что первый результат — нужная книга.
 * high — он один явно лучше остальных; тогда можно сразу открыть страницу книги.
 */
export function assessConfidence(ranked: RankedCandidate[]): Confidence {
  const [first, second] = ranked;
  if (!first) return "low";
  const margin = first.score - (second?.score ?? 0);
  if (first.score >= 0.75 && margin >= 0.15) return "high";
  if (first.score >= 0.5) return "medium";
  return "low";
}

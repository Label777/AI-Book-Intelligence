/**
 * Отчёт о покрытии источниками и проверка оглавления.
 *
 * Порог запуска (docs/03-architecture.md, шаг 2): описание книги и два независимых
 * источника о содержании. Оглавление считается подтверждённым, только если оно взято
 * из файла пользователя или совпало в двух независимых источниках.
 */
import { SIMILARITY } from "../config";
import type { Coverage, Source, SourceKind } from "../schema";
import { similarity } from "../text";

/** Источники, по которым можно судить о содержании книги. */
const CONTENT_KINDS: SourceKind[] = ["encyclopedia", "review", "interview", "research"];
const CRITICISM_KINDS: SourceKind[] = ["review", "research"];

export interface TocCandidate {
  sourceId: string;
  chapters: string[];
}

export interface TocResult {
  verified: boolean;
  chapters: string[];
  sourceIds: string[];
}

const MIN_CHAPTERS = 3;

function agreement(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const matched = shorter.filter((title) =>
    longer.some((other) => similarity(title, other) >= SIMILARITY.sameChapter),
  ).length;
  return matched / longer.length;
}

/**
 * Подтверждает оглавление. Одного источника недостаточно, если это не сам текст книги:
 * названия глав не должны появляться из единственного пересказа.
 */
export function verifyToc(candidates: TocCandidate[], sources: Source[]): TocResult {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const usable = candidates.filter(
    (c) =>
      byId.has(c.sourceId) && c.chapters.filter((t) => t.trim()).length >= MIN_CHAPTERS,
  );

  const fromBook = usable.find((c) => byId.get(c.sourceId)!.kind === "user_text");
  if (fromBook) {
    return {
      verified: true,
      chapters: fromBook.chapters,
      sourceIds: [fromBook.sourceId],
    };
  }

  for (let i = 0; i < usable.length; i++) {
    for (let j = i + 1; j < usable.length; j++) {
      const domainA = byId.get(usable[i].sourceId)!.domain;
      const domainB = byId.get(usable[j].sourceId)!.domain;
      const independent = domainA !== null && domainB !== null && domainA !== domainB;
      if (!independent) continue;
      if (agreement(usable[i].chapters, usable[j].chapters) >= SIMILARITY.tocAgreement) {
        const longer =
          usable[i].chapters.length >= usable[j].chapters.length ? usable[i] : usable[j];
        return {
          verified: true,
          chapters: longer.chapters.map((t) => t.trim()),
          sourceIds: [usable[i].sourceId, usable[j].sourceId],
        };
      }
    }
  }
  return { verified: false, chapters: [], sourceIds: [] };
}

export function buildCoverage(sources: Source[], hasVerifiedToc: boolean): Coverage {
  const withText = sources.filter((s) => s.excerpts.length > 0);
  const byKind: Record<string, number> = {};
  for (const source of withText) byKind[source.kind] = (byKind[source.kind] ?? 0) + 1;

  const hasDescription = withText.some((s) => s.kind === "description");
  const hasUserText = withText.some((s) => s.kind === "user_text");
  const contentDomains = new Set(
    withText
      .filter((s) => CONTENT_KINDS.includes(s.kind))
      .map((s) => s.domain ?? `без-домена:${s.id}`),
  );
  const independentContentSources = contentDomains.size;
  const hasCriticism = withText.some((s) => CRITICISM_KINDS.includes(s.kind));

  const missing: string[] = [];
  if (!hasDescription && !hasUserText)
    missing.push("Описание книги от издателя или из каталога");
  if (!hasVerifiedToc)
    missing.push("Подтверждённое оглавление — разбор будет по темам, а не по главам");
  if (independentContentSources < 2 && !hasUserText) {
    missing.push("Два независимых источника о содержании книги");
  }
  if (!hasCriticism) missing.push("Рецензии и критика — критический раздел будет короче");

  let level: Coverage["level"];
  if (hasUserText || (hasDescription && independentContentSources >= 2))
    level = "sufficient";
  else if (
    independentContentSources >= 1 &&
    (hasDescription || independentContentSources >= 2)
  ) {
    level = "limited";
  } else level = "insufficient";

  return {
    level,
    hasDescription,
    hasVerifiedToc,
    independentContentSources,
    hasCriticism,
    byKind,
    missing,
  };
}

/**
 * Проверки утверждений: привязка к источникам и дословные цитаты.
 * Это механизмы из таблицы «Как запреты из ТЗ превращаются в механизмы»
 * (docs/03-architecture.md, раздел 4). Проверяет код, а не модель.
 */
import { LIMITS } from "../config";
import type { Claim, Source, SourceKind } from "../schema";
import { normalizeForMatch, wordCount } from "../text";

export interface ClaimProblem {
  claimId: string;
  code:
    | "empty_text"
    | "too_long"
    | "no_evidence"
    | "unknown_source"
    | "unknown_excerpt"
    | "wrong_source_kind"
    | "no_basis"
    | "unknown_basis"
    | "self_reference"
    | "quote_not_found"
    | "quote_too_long"
    | "unmarked_quote";
  message: string;
}

/** Источники, которые говорят о самой книге, а не проверяют её снаружи. */
const NOT_EXTERNAL: SourceKind[] = ["description", "toc", "user_text"];

function excerptText(sources: Map<string, Source>, sourceId: string, excerptId: string) {
  return sources.get(sourceId)?.excerpts.find((e) => e.id === excerptId)?.text ?? null;
}

/**
 * Каждое утверждение должно на что-то опираться:
 * факт и внешнее исследование — на конкретную выдержку из источника,
 * интерпретация и критика — на другие утверждения или на источник.
 */
export function checkGrounding(claims: Claim[], sources: Source[]): ClaimProblem[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const claimIds = new Set(claims.map((c) => c.id));
  const problems: ClaimProblem[] = [];
  const add = (claimId: string, code: ClaimProblem["code"], message: string) =>
    problems.push({ claimId, code, message });

  for (const claim of claims) {
    if (!claim.text.trim()) add(claim.id, "empty_text", "Пустой текст утверждения.");
    if (claim.text.length > LIMITS.claimMaxChars) {
      add(claim.id, "too_long", `Утверждение длиннее ${LIMITS.claimMaxChars} символов.`);
    }

    for (const ev of claim.evidence) {
      const source = byId.get(ev.sourceId);
      if (!source) {
        add(claim.id, "unknown_source", `Источник ${ev.sourceId} не существует.`);
      } else if (ev.excerptId && !source.excerpts.some((e) => e.id === ev.excerptId)) {
        add(
          claim.id,
          "unknown_excerpt",
          `В источнике ${ev.sourceId} нет выдержки ${ev.excerptId}.`,
        );
      }
    }

    const needsExcerpt = claim.type === "book_fact" || claim.type === "external_research";
    if (needsExcerpt) {
      const cited = claim.evidence.filter((ev) => ev.excerptId && byId.has(ev.sourceId));
      if (cited.length === 0) {
        add(claim.id, "no_evidence", "Нет ссылки на конкретную выдержку из источника.");
      }
      if (
        claim.type === "external_research" &&
        cited.length > 0 &&
        cited.every((ev) => NOT_EXTERNAL.includes(byId.get(ev.sourceId)!.kind))
      ) {
        add(
          claim.id,
          "wrong_source_kind",
          "Внешнее исследование должно опираться на источник за пределами книги.",
        );
      }
    } else if (claim.basedOn.length === 0 && claim.evidence.length === 0) {
      add(claim.id, "no_basis", "Вывод не опирается ни на факты, ни на источники.");
    }

    for (const ref of claim.basedOn) {
      if (ref === claim.id)
        add(claim.id, "self_reference", "Утверждение ссылается на себя.");
      else if (!claimIds.has(ref)) {
        add(claim.id, "unknown_basis", `Утверждение ${ref} не существует.`);
      }
    }
  }
  return problems;
}

/** Совпадает ли цитата с выдержкой дословно (с точностью до регистра, кавычек и пробелов). */
export function isExactQuote(quote: string, excerpt: string): boolean {
  const q = normalizeForMatch(quote)
    .replace(/^["']+|["']+$/g, "")
    .trim();
  return q.length > 0 && normalizeForMatch(excerpt).includes(q);
}

const QUOTED_SPAN = /«([^»]{12,})»|“([^”]{12,})”|"([^"]{12,})"/g;
/** Короткие выражения в кавычках — термины и названия, а не цитаты. */
const MIN_QUOTE_WORDS = 5;

/** Фрагменты в кавычках внутри текста, достаточно длинные, чтобы быть цитатой. */
export function quotedSpans(text: string): string[] {
  const spans: string[] = [];
  for (const match of text.matchAll(QUOTED_SPAN)) {
    const span = match[1] ?? match[2] ?? match[3];
    if (span && wordCount(span) >= MIN_QUOTE_WORDS) spans.push(span);
  }
  return spans;
}

/**
 * Цитаты: допустимы только при точном совпадении с выдержкой и не длиннее лимита.
 * Длинный фрагмент в кавычках прямо в тексте утверждения считается цитатой
 * и тоже должен найтись в источниках этого утверждения.
 */
export function checkQuotes(claims: Claim[], sources: Source[]): ClaimProblem[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  const problems: ClaimProblem[] = [];

  for (const claim of claims) {
    const cited = claim.evidence.flatMap((ev) => {
      const source = byId.get(ev.sourceId);
      if (!source) return [];
      return ev.excerptId
        ? source.excerpts.filter((e) => e.id === ev.excerptId)
        : source.excerpts;
    });

    if (claim.quote) {
      const excerpt = claim.evidence
        .map((ev) => excerptText(byId, ev.sourceId, claim.quote!.excerptId))
        .find((text) => text !== null);
      if (claim.quote.text.length > LIMITS.quoteMaxChars) {
        problems.push({
          claimId: claim.id,
          code: "quote_too_long",
          message: `Цитата длиннее ${LIMITS.quoteMaxChars} символов.`,
        });
      } else if (!excerpt || !isExactQuote(claim.quote.text, excerpt)) {
        problems.push({
          claimId: claim.id,
          code: "quote_not_found",
          message: "Цитата не совпадает с выдержкой из источника дословно.",
        });
      }
    }

    for (const span of quotedSpans(claim.text)) {
      if (!cited.some((excerpt) => isExactQuote(span, excerpt.text))) {
        problems.push({
          claimId: claim.id,
          code: "unmarked_quote",
          message: `Фрагмент в кавычках не найден в источниках утверждения: «${span.slice(0, 60)}…»`,
        });
      }
    }
  }
  return problems;
}

/**
 * Применяет лимит на число цитат в анализе: лишние цитаты снимаются
 * (утверждение остаётся, но без дословного фрагмента). Возвращает новые утверждения.
 */
export function enforceQuoteBudget(
  claims: Claim[],
  max: number = LIMITS.maxQuotes,
): Claim[] {
  let used = 0;
  return claims.map((claim) => {
    if (!claim.quote) return claim;
    used += 1;
    return used > max ? { ...claim, quote: null } : claim;
  });
}

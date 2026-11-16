/**
 * Шаг 2. Сбор и проверка источников.
 *
 * 1. Модель ищет в интернете сведения о книге. API возвращает дословные фрагменты
 *    найденных страниц — они становятся выдержками источников. Модель их не пишет,
 *    поэтому на них можно опираться при проверке фактов и цитат.
 * 2. Отдельный вызов определяет вид каждого источника и выписывает оглавление там,
 *    где оно приведено. Названия глав принимаются, только если они есть в выдержке.
 * 3. Код подтверждает оглавление по двум независимым источникам и считает покрытие.
 */
import { z } from "zod";

import { buildCoverage, verifyToc, type TocCandidate } from "../checks/coverage";
import { LIMITS } from "../config";
import type { WebCitation } from "../model";
import type { Step } from "../runner";
import {
  coverageSchema,
  RELIABILITY,
  SOURCE_KINDS,
  sourceSchema,
  type Book,
  type Source,
} from "../schema";
import { domainOf, normalizeLoose, truncate } from "../text";
import { bookLine, formatSources, generateChecked, systemPrompt } from "./shared";
import { need, type AnalysisState } from "./state";

export const sourcesOutputSchema = z.object({
  sources: z.array(sourceSchema),
  toc: z.object({
    verified: z.boolean(),
    chapters: z.array(z.string()),
    sourceIds: z.array(z.string()),
  }),
  coverage: coverageSchema,
});
export type SourcesOutput = z.infer<typeof sourcesOutputSchema>;

/** Аннотация из каталога — первый источник; делится на выдержки по предложениям. */
function catalogSource(book: Book, retrievedAt: string): Source | null {
  if (!book.description) return null;
  const sentences = book.description.match(/[^.!?…]+[.!?…]*\s*/g) ?? [book.description];
  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > LIMITS.excerptMaxChars) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  const excerpts = chunks.slice(0, LIMITS.excerptsPerSource).map((text, i) => ({
    id: `s0e${i + 1}`,
    text: truncate(text, LIMITS.excerptMaxChars),
  }));
  if (excerpts.length === 0) return null;
  return {
    id: "s0",
    kind: "description",
    title: `Аннотация из каталога: ${book.title}`,
    url: null,
    domain: null,
    retrievedAt,
    reliability: "medium",
    excerpts,
  };
}

/** Собирает источники из ссылок веб-поиска: один адрес — один источник. */
export function sourcesFromCitations(
  citations: WebCitation[],
  retrievedAt: string,
): Source[] {
  const byUrl = new Map<string, { title: string | null; texts: string[] }>();
  for (const citation of citations) {
    const text = truncate(citation.citedText, LIMITS.excerptMaxChars);
    if (!citation.url || !text) continue;
    const entry = byUrl.get(citation.url) ?? { title: citation.title, texts: [] };
    const known = entry.texts.some((t) => normalizeLoose(t) === normalizeLoose(text));
    if (!known && entry.texts.length < LIMITS.excerptsPerSource) entry.texts.push(text);
    byUrl.set(citation.url, entry);
  }
  return [...byUrl.entries()].slice(0, LIMITS.maxSources).map(([url, entry], index) => {
    const id = `s${index + 1}`;
    return {
      id,
      kind: "other",
      title: entry.title?.trim() || domainOf(url) || url,
      url,
      domain: domainOf(url),
      retrievedAt,
      reliability: "medium",
      excerpts: entry.texts.map((text, i) => ({ id: `${id}e${i + 1}`, text })),
    } satisfies Source;
  });
}

const classificationSchema = z.object({
  sources: z.array(
    z.object({
      sourceId: z.string(),
      kind: z.enum(SOURCE_KINDS),
      reliability: z.enum(RELIABILITY),
    }),
  ),
  tocCandidates: z.array(
    z.object({ sourceId: z.string(), chapters: z.array(z.string()) }),
  ),
});

function researchPrompt(book: Book): string {
  return `Find reliable public information about the book ${bookLine(book)}.

Search for, in this order:
1. the publisher's or the author's own description of the book;
2. its table of contents — the exact chapter titles;
3. an encyclopedia article about the book;
4. at least two independent in-depth reviews or analyses of its content, from different sites;
5. interviews or talks in which the author explains the book's ideas;
6. criticism of the book, and studies that test, support or contradict its claims.

Then write a factual report of what these sources say about: the central argument; the structure and chapter titles; key concepts and terms; the examples and evidence the author uses; the author's stated intent and worldview; criticism and what later research found.

Support every statement with a search result. Where something cannot be found, say so plainly and do not fill the gap from memory. Prefer primary and reputable sources; avoid sites that only republish automatic summaries.`;
}

function classifyPrompt(book: Book, sources: Source[]): string {
  return `These sources were collected about the book ${bookLine(book)}.

${formatSources(sources)}

For every source return its kind and reliability:
- description — the publisher's, author's or catalogue's own description of the book;
- toc — a page whose excerpt is mainly the table of contents;
- encyclopedia — an encyclopedia article;
- review — a review, analysis or summary written by someone other than the author;
- interview — the author speaking about the book;
- research — a study or scholarly work that tests or discusses the book's claims;
- other — anything else, including pages that are not really about this book.
Reliability: high for publishers, the author, encyclopedias, academic and established media; medium for known blogs and review sites; low for anonymous, promotional or automatically generated pages.

Then fill tocCandidates: for each source whose excerpts explicitly list the book's chapter titles, return those titles in order, copied exactly as written in the excerpt. Do not add chapters that are not in the excerpt, and do not list a source that only discusses chapters without naming them. Return an empty list if no source lists chapter titles.`;
}

/** Оставляет только те названия глав, которые действительно есть в выдержках источника. */
function groundedToc(candidates: TocCandidate[], sources: Source[]): TocCandidate[] {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return candidates.flatMap((candidate) => {
    const source = byId.get(candidate.sourceId);
    if (!source) return [];
    const haystack = normalizeLoose(source.excerpts.map((e) => e.text).join(" "));
    const chapters = candidate.chapters
      .map((title) => title.trim())
      .filter(
        (title) =>
          normalizeLoose(title).length > 2 && haystack.includes(normalizeLoose(title)),
      );
    return chapters.length > 0 ? [{ sourceId: candidate.sourceId, chapters }] : [];
  });
}

export const sourcesStep: Step<AnalysisState, SourcesOutput> = {
  name: "sources",
  version: "1",
  tiers: ["main"],
  schema: sourcesOutputSchema,
  input: (state) => ({ book: state.book, language: state.request.language }),
  async run(state, ctx) {
    const book = need(state, "book");
    const language = state.request.language;
    const retrievedAt = ctx.now().toISOString();

    const research = await ctx.model.research({
      task: "sources.research",
      tier: "main",
      system: systemPrompt(language),
      prompt: researchPrompt(book),
      maxSearches: LIMITS.maxWebSearches,
    });

    const catalog = catalogSource(book, retrievedAt);
    const found = sourcesFromCitations(research.citations, retrievedAt);
    let sources = catalog ? [catalog, ...found] : found;
    let candidates: TocCandidate[] = [];

    if (found.length > 0) {
      const classified = await generateChecked(
        ctx.model,
        {
          task: "sources.classify",
          tier: "main",
          system: systemPrompt(language),
          prompt: classifyPrompt(book, found),
          schema: classificationSchema,
        },
        (object) => {
          const known = new Set(found.map((s) => s.id));
          const missing = found.filter(
            (s) => !object.sources.some((c) => c.sourceId === s.id),
          );
          const problems = [
            ...missing.map((s) => `Source ${s.id} was not classified.`),
            ...object.sources
              .filter((c) => !known.has(c.sourceId))
              .map((c) => `Source ${c.sourceId} does not exist.`),
          ];
          return { result: object, problems };
        },
      );
      const kinds = new Map(classified.sources.map((c) => [c.sourceId, c]));
      sources = sources.map((source) => {
        const c = kinds.get(source.id);
        return c ? { ...source, kind: c.kind, reliability: c.reliability } : source;
      });
      candidates = groundedToc(classified.tocCandidates, sources);
    }

    const toc = verifyToc(candidates, sources);
    return { sources, toc, coverage: buildCoverage(sources, toc.verified) };
  },
  apply: (state, sources) => ({ ...state, sources }),
  halt(output) {
    return output.coverage.level === "insufficient"
      ? "Открытых источников о книге недостаточно для достоверного анализа. " +
          `Не хватает: ${output.coverage.missing.join("; ").toLowerCase()}.`
      : null;
  },
};

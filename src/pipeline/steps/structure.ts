/**
 * Шаг 3. Анализ структуры.
 *
 * Если оглавление подтверждено, единицы разбора — главы, и модель не вызывается.
 * Если нет — названия глав не придумываются: модель выделяет темы книги,
 * и каждая тема должна опираться на выдержку из источников.
 */
import { z } from "zod";

import { findDuplicates } from "../checks/duplicates";
import { COUNTS, LIMITS } from "../config";
import type { Step } from "../runner";
import { evidenceSchema, structureSchema, type Structure } from "../schema";
import { bookLine, formatSources, generateChecked, systemPrompt } from "./shared";
import { need, type AnalysisState } from "./state";

export type StructureOutput = Structure;

const themesSchema = z.object({
  themes: z.array(z.object({ title: z.string(), evidence: z.array(evidenceSchema) })),
});

export const structureStep: Step<AnalysisState, StructureOutput> = {
  name: "structure",
  version: "1",
  tiers: ["main"],
  schema: structureSchema,
  input: (state) => ({
    book: state.book,
    sources: state.sources?.sources,
    toc: state.sources?.toc,
    language: state.request.language,
  }),
  async run(state, ctx) {
    const book = need(state, "book");
    const { sources, toc } = need(state, "sources");

    if (toc.verified) {
      return {
        kind: "chapters",
        verified: true,
        tocSourceIds: toc.sourceIds,
        units: toc.chapters.map((title, i) => ({ id: `u${i + 1}`, title })),
      };
    }

    const [minThemes, maxThemes] = COUNTS.themes;
    const excerptIds = new Set(
      sources.flatMap((s) => s.excerpts.map((e) => `${s.id}:${e.id}`)),
    );
    const themes = await generateChecked(
      ctx.model,
      {
        task: "structure.themes",
        tier: "main",
        system: systemPrompt(state.request.language),
        prompt: `The table of contents of the book ${bookLine(book)} could not be confirmed, so the analysis will be organised by themes instead of chapters.

${formatSources(sources)}

Identify ${minThemes} to ${maxThemes} main themes of the book's content as the sources describe it, in a logical reading order. A theme is a part of the book's argument, not a chapter title: do not phrase themes as if they were chapter names. For each theme give a short title (at most ${LIMITS.titleMaxChars} characters) and the evidence: the excerpts that show the book covers it. Themes must not overlap.`,
        schema: themesSchema,
      },
      (object) => {
        const problems: string[] = [];
        const grounded = object.themes.filter((theme) => {
          const title = theme.title.trim();
          const ok =
            title.length > 0 &&
            title.length <= LIMITS.titleMaxChars &&
            theme.evidence.some(
              (ev) => ev.excerptId && excerptIds.has(`${ev.sourceId}:${ev.excerptId}`),
            );
          if (!ok)
            problems.push(
              `Theme "${title}" has no valid evidence or its title is too long.`,
            );
          return ok;
        });
        const duplicates = new Set(
          findDuplicates(grounded.map((t, i) => ({ id: String(i), text: t.title }))).map(
            (d) => Number(d.drop),
          ),
        );
        if (duplicates.size > 0) problems.push("Some themes repeat each other.");
        const kept = grounded.filter((_, i) => !duplicates.has(i)).slice(0, maxThemes);
        if (object.themes.length > maxThemes)
          problems.push(`More than ${maxThemes} themes.`);
        if (kept.length < minThemes) {
          problems.push(`Fewer than ${minThemes} grounded themes.`);
          return { result: null, problems };
        }
        return { result: kept, problems };
      },
    );

    return {
      kind: "themes",
      verified: false,
      tocSourceIds: [],
      units: themes.map((theme, i) => ({ id: `u${i + 1}`, title: theme.title.trim() })),
    };
  },
  apply: (state, structure) => ({ ...state, structure }),
};

/**
 * Шаг 4. Саммари.
 *
 * Модель выписывает из источников факты о книге — по главам или темам — и общий обзор.
 * Каждый факт обязан ссылаться на выдержку; факты без опоры отбрасываются.
 * Глава, о содержании которой в источниках ничего нет, остаётся пустой: её не сочиняют.
 */
import { z } from "zod";

import type { Step } from "../runner";
import {
  claimDraftSchema,
  claimSchema,
  overviewSchema,
  unitSummarySchema,
  type ClaimDraft,
} from "../schema";
import {
  bookLine,
  formatSources,
  generateChecked,
  reviewDrafts,
  systemPrompt,
} from "./shared";
import { need, type AnalysisState } from "./state";

export const summaryOutputSchema = z.object({
  claims: z.array(claimSchema),
  overview: overviewSchema,
  units: z.array(unitSummarySchema),
});
export type SummaryOutput = z.infer<typeof summaryOutputSchema>;

const draft = claimDraftSchema.nullable();

const summaryDraftSchema = z.object({
  overview: z.object({ problem: draft, intent: draft, solution: draft, audience: draft }),
  units: z.array(
    z.object({
      unitId: z.string(),
      facts: z.array(claimDraftSchema),
      conclusion: draft,
      link: draft,
    }),
  ),
  /** Важные факты о книге, не привязанные к одной главе или теме. */
  general: z.array(claimDraftSchema),
});

/** Минимум фактов, без которого дальнейший разбор не на что опереть. */
const MIN_FACTS = 6;

export const summaryStep: Step<AnalysisState, SummaryOutput> = {
  name: "summary",
  version: "1",
  tiers: ["main"],
  schema: summaryOutputSchema,
  input: (state) => ({
    book: state.book,
    sources: state.sources?.sources,
    structure: state.structure,
    language: state.request.language,
  }),
  async run(state, ctx) {
    const book = need(state, "book");
    const { sources } = need(state, "sources");
    const structure = need(state, "structure");
    const unitWord = structure.kind === "chapters" ? "chapter" : "theme";

    return generateChecked(
      ctx.model,
      {
        task: "summary",
        tier: "main",
        system: systemPrompt(state.request.language),
        maxTokens: 12000,
        prompt: `Extract what the sources establish about the content of the book ${bookLine(book)}.

${formatSources(sources)}

The analysis is organised by these ${unitWord}s:
${structure.units.map((unit) => `${unit.id} — ${unit.title}`).join("\n")}

Return:
1. overview — four claims: "problem" (the question or problem the book addresses), "intent" (what the author wants to convey), "solution" (what answer the book gives), "audience" (who benefits from it). Use book_fact where an excerpt supports it; otherwise ai_interpretation based on facts you extract below; null if there is no basis at all.
2. units — for every ${unitWord} above, in the same order and with the same unitId:
   - facts: two to five book_fact claims about what this ${unitWord} says, each citing its excerpt. If the sources say nothing about it, return an empty list — do not guess.
   - conclusion: one ai_interpretation with the main takeaway of this ${unitWord}, based on its facts; null if there are no facts.
   - link: one ai_interpretation on how it connects to the previous ${unitWord}; null for the first one or when unclear.
3. general — further book_fact claims that matter for understanding the book but belong to no single ${unitWord}: the evidence and examples the author uses, definitions of the author's terms, stated assumptions, facts about how the book was written or received.

Extract every distinct fact the excerpts support; later steps can only build on facts listed here.`,
        schema: summaryDraftSchema,
      },
      (object) => {
        const problems: string[] = [];
        const known = new Map(structure.units.map((unit) => [unit.id, unit]));
        const drafts: ClaimDraft[] = [];
        const push = (d: ClaimDraft | null) => {
          if (d) drafts.push(d);
        };
        Object.values(object.overview).forEach(push);
        for (const unit of object.units) {
          unit.facts.forEach(push);
          push(unit.conclusion);
          push(unit.link);
        }
        object.general.forEach(push);

        const review = reviewDrafts(drafts, [], sources);
        problems.push(...review.problems);

        const units = structure.units.map((unit) => {
          const given = object.units.find((u) => u.unitId === unit.id);
          if (!given) problems.push(`Unit ${unit.id} is missing from the answer.`);
          return {
            unitId: unit.id,
            facts: (given?.facts ?? []).flatMap((d) => review.idOf(d) ?? []),
            conclusion: review.idOf(given?.conclusion),
            link: review.idOf(given?.link),
          };
        });
        for (const unit of object.units) {
          if (!known.has(unit.unitId))
            problems.push(`Unit ${unit.unitId} does not exist.`);
        }

        const overview = {
          problem: review.idOf(object.overview.problem),
          intent: review.idOf(object.overview.intent),
          solution: review.idOf(object.overview.solution),
          audience: review.idOf(object.overview.audience),
        };
        const facts = review.claims.filter((claim) => claim.type === "book_fact").length;
        const coveredUnits = units.filter((unit) => unit.facts.length > 0).length;
        const overviewFilled = Object.values(overview).filter(Boolean).length;

        if (facts < MIN_FACTS)
          problems.push(
            `Only ${facts} supported facts; at least ${MIN_FACTS} are needed.`,
          );
        if (overviewFilled < 2)
          problems.push("The overview has fewer than two grounded claims.");

        const acceptable = facts >= MIN_FACTS && coveredUnits > 0 && overviewFilled >= 2;
        return {
          result: acceptable ? { claims: review.claims, overview, units } : null,
          problems,
        };
      },
    );
  },
  apply: (state, summary) => ({ ...state, summary }),
};

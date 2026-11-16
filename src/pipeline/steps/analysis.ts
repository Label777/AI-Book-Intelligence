/**
 * Шаг 5. Глубокий аналитический разбор.
 *
 * Восемь независимых вызовов: идеи, инсайты, концепции, мировоззрение автора, критика,
 * связи, выводы, оценки. Каждый получает проверенные факты шага 4, а не сырой текст,
 * и список уже сформулированных мыслей — чтобы разделы не пересказывали друг друга.
 * У каждой идеи и инсайта есть действие; его конкретность проверяет код.
 */
import { z } from "zod";

import { checkAction } from "../checks/actions";
import { findDuplicates } from "../checks/duplicates";
import { COUNTS } from "../config";
import type { ModelClient } from "../model";
import type { Step } from "../runner";
import {
  actionDraftSchema,
  claimDraftSchema,
  claimSchema,
  CONCEPT_KINDS,
  contentSchema,
  CRITIQUE_GROUPS,
  HIGHLIGHT_KINDS,
  SCORE_DIMENSIONS,
  type Action,
  type ActionDraft,
  type Book,
  type Claim,
  type ClaimDraft,
  type Content,
  type Source,
} from "../schema";
import {
  bookLine,
  formatClaims,
  formatSources,
  generateChecked,
  reviewDrafts,
  StepCheckError,
  systemPrompt,
  type Language,
  type Review,
} from "./shared";
import { need, type AnalysisState } from "./state";

/** Содержание без схем: их добавляет шаг 6. */
export const analysisOutputSchema = z.object({
  claims: z.array(claimSchema),
  content: contentSchema,
  /** Разделы, которые не удалось построить на имеющихся источниках. */
  warnings: z.array(z.string()),
});
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

const draft = claimDraftSchema;
const maybe = claimDraftSchema.nullable();

const ideasDraft = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      statement: draft,
      explanation: maybe,
      importance: maybe,
      action: actionDraftSchema,
    }),
  ),
});
const insightsDraft = z.object({
  insights: z.array(
    z.object({
      essence: draft,
      explanation: maybe,
      example: maybe,
      mindShift: maybe,
      action: actionDraftSchema,
    }),
  ),
});
const conceptsDraft = z.object({
  concepts: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(CONCEPT_KINDS),
      statement: draft,
      explanation: maybe,
    }),
  ),
});
const worldviewDraft = z.object({
  lens: maybe,
  beliefs: z.array(draft),
  thinkingModel: maybe,
});
const critiqueDraft = z.object({
  strengths: z.array(draft),
  weaknesses: z.array(draft),
  disputed: z.array(draft),
  unproven: z.array(draft),
  outdated: z.array(draft),
  contradicted: z.array(draft),
});
const connectionsDraft = z.object({
  theories: z.array(z.object({ name: z.string(), relation: draft })),
  books: z.array(z.object({ title: z.string(), author: z.string(), relation: draft })),
  combinations: z.array(draft),
});
const takeawaysDraft = z.object({ main: maybe, items: z.array(draft) });
const scoresDraft = z.object({
  scores: z.array(
    z.object({
      dimension: z.enum(SCORE_DIMENSIONS),
      value: z.number(),
      rationale: draft,
    }),
  ),
  highlights: z.array(
    z.object({
      kind: z.enum(HIGHLIGHT_KINDS),
      ideaId: z.string().nullable(),
      reason: draft,
    }),
  ),
});

/** Общие данные для всех модулей разбора. */
interface Scope {
  model: ModelClient;
  language: Language;
  book: Book;
  sources: Source[];
}

/** Вводная часть промпта: книга, факты и уже сформулированные мысли. */
function context(scope: Scope, claims: Claim[], withSources: boolean): string {
  const sources = withSources ? `\nSources:\n${formatSources(scope.sources)}\n` : "";
  return `Book: ${bookLine(scope.book)}.
${sources}
Claims established so far (id | type | text). Refer to them in basedOn by id:
${formatClaims(claims)}
`;
}

const ACTION_RULES = `Each "action" answers "what should I do with this": one concrete step a reader can take, not general advice. Fill "text" (the whole step, starting with a verb, 25–220 characters), "object" (the thing acted on), "when" (the moment or trigger), "horizon" ("24h", "7d" or "30d" — when the reader can do it) and "context" ("work", "business" or "life"). Wording such as "try to", "be more", "remember that", "it is important to" is rejected.`;

function acceptAction(
  actionDraft: ActionDraft,
  claimId: string,
  actions: Action[],
  label: string,
  problems: string[],
): string | null {
  const found = checkAction(actionDraft);
  if (found.length > 0) {
    problems.push(...found.map((problem) => `Action of ${label}: ${problem}`));
    return null;
  }
  const id = `a${actions.length + 1}`;
  actions.push({ ...actionDraft, text: actionDraft.text.trim(), id, claimId });
  return id;
}

/** Убирает элементы, чьё главное утверждение повторяет более раннее (в этом списке или в `earlier`). */
function dropRepeats<T>(
  items: T[],
  textOf: (item: T) => string,
  earlier: string[],
  label: string,
  problems: string[],
): T[] {
  const pool = [
    ...earlier.map((text, i) => ({ id: `earlier${i}`, text })),
    ...items.map((item, i) => ({ id: String(i), text: textOf(item) })),
  ];
  const repeats = new Set(
    findDuplicates(pool)
      .filter((pair) => !pair.drop.startsWith("earlier"))
      .map((pair) => Number(pair.drop)),
  );
  if (repeats.size > 0)
    problems.push(`${repeats.size} ${label} repeat thoughts stated earlier.`);
  return items.filter((_, i) => !repeats.has(i));
}

function textOfClaim(claims: Claim[], id: string): string {
  return claims.find((claim) => claim.id === id)?.text ?? "";
}

function below<R>(
  count: number,
  min: number,
  what: string,
  problems: string[],
  result: R,
): Review<R> {
  if (count < min) {
    problems.push(`Only ${count} grounded ${what}; at least ${min} are needed.`);
    return { result: null, problems };
  }
  return { result, problems };
}

/**
 * Раздел, без которого анализ остаётся осмысленным. Если модель не смогла построить его
 * на имеющихся фактах, раздел остаётся пустым и попадает в отчёт — вместо того чтобы
 * ронять весь анализ или заполняться необоснованным текстом.
 */
async function optional<R>(
  section: string,
  warnings: string[],
  build: () => Promise<R>,
  fallback: () => R,
): Promise<R> {
  try {
    return await build();
  } catch (error) {
    if (!(error instanceof StepCheckError)) throw error;
    warnings.push(`${section}: ${error.problems.slice(0, 3).join(" | ")}`);
    return fallback();
  }
}

export const analysisStep: Step<AnalysisState, AnalysisOutput> = {
  name: "analysis",
  version: "1",
  tiers: ["main", "deep"],
  schema: analysisOutputSchema,
  input: (state) => ({
    book: state.book,
    sources: state.sources?.sources,
    structure: state.structure,
    summary: state.summary,
    language: state.request.language,
  }),
  async run(state, ctx) {
    const book = need(state, "book");
    const { sources } = need(state, "sources");
    const structure = need(state, "structure");
    const summary = need(state, "summary");
    const language = state.request.language;
    const scope: Scope = { model: ctx.model, language, book, sources };
    const system = systemPrompt(language);

    let claims = summary.claims;
    const actions: Action[] = [];
    const warnings: string[] = [];

    /* ── Главные идеи ── */
    const [minIdeas, maxIdeas] = COUNTS.ideas;
    const ideas = await generateChecked(
      ctx.model,
      {
        task: "analysis.ideas",
        tier: "deep",
        system,
        maxTokens: 8000,
        schema: ideasDraft,
        prompt: `${context(scope, claims, false)}
Select the ${minIdeas} to ${maxIdeas} most important ideas of this book. For each:
- title: a short name of the idea;
- statement: the idea itself — reuse a book_fact's meaning as an ai_interpretation based on the facts that carry it (list them in basedOn);
- explanation: the idea explained in simple language for someone who has not read the book (ai_interpretation);
- importance: why this idea matters (ai_interpretation);
- action.
${ACTION_RULES}
Ideas must be distinct from one another, and each must rest on at least one book_fact above.`,
      },
      (object) => {
        const problems: string[] = [];
        const drafts = object.ideas.flatMap((i) => [
          i.statement,
          i.explanation,
          i.importance,
        ]);
        const review = reviewDrafts(
          drafts.filter((d): d is ClaimDraft => d !== null),
          claims,
          sources,
        );
        problems.push(...review.problems);
        const localActions: Action[] = [...actions];
        const accepted = dropRepeats(
          object.ideas.filter((i) => review.idOf(i.statement)),
          (i) => i.statement.text,
          [],
          "ideas",
          problems,
        ).slice(0, maxIdeas);
        const items = accepted.map((idea, n) => {
          const statement = review.idOf(idea.statement)!;
          return {
            id: `idea${n + 1}`,
            title: idea.title.trim() || `${n + 1}`,
            statement,
            explanation: review.idOf(idea.explanation),
            importance: review.idOf(idea.importance),
            actionId: acceptAction(
              idea.action,
              statement,
              localActions,
              `idea "${idea.title}"`,
              problems,
            ),
          };
        });
        return below(items.length, minIdeas, "ideas", problems, {
          items,
          claims: review.claims,
          actions: localActions,
        });
      },
    );
    claims = ideas.claims;
    actions.splice(0, actions.length, ...ideas.actions);
    const ideaTexts = ideas.items.map((idea) => textOfClaim(claims, idea.statement));

    /* ── Самые ценные инсайты ── */
    const [minInsights, maxInsights] = COUNTS.insights;
    const insights = await optional(
      "insights",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.insights",
            tier: "deep",
            system,
            maxTokens: 9000,
            schema: insightsDraft,
            prompt: `${context(scope, claims, false)}
The main ideas are already listed above (the claims introduced after the facts). Now find up to ${maxInsights} of the most valuable insights of the book: non-obvious consequences, tensions, mechanisms or shifts of perspective that a reader would not get from the list of main ideas. Do not restate a main idea. For each:
- essence: the insight (ai_interpretation based on facts);
- explanation: how it follows from the book (ai_interpretation);
- example: a realistic everyday example that illustrates it — your own illustration, so type ai_interpretation, and never present it as an example from the book;
- mindShift: how this can change the way a person thinks (ai_interpretation);
- action.
${ACTION_RULES}
Return fewer insights rather than weaker ones.`,
          },
          (object) => {
            const problems: string[] = [];
            const drafts = object.insights.flatMap((i) => [
              i.essence,
              i.explanation,
              i.example,
              i.mindShift,
            ]);
            const review = reviewDrafts(
              drafts.filter((d): d is ClaimDraft => d !== null),
              claims,
              sources,
            );
            problems.push(...review.problems);
            const localActions: Action[] = [...actions];
            const accepted = dropRepeats(
              object.insights.filter((i) => review.idOf(i.essence)),
              (i) => i.essence.text,
              ideaTexts,
              "insights",
              problems,
            ).slice(0, maxInsights);
            const items = accepted.map((insight, n) => {
              const essence = review.idOf(insight.essence)!;
              return {
                id: `insight${n + 1}`,
                essence,
                explanation: review.idOf(insight.explanation),
                example: review.idOf(insight.example),
                mindShift: review.idOf(insight.mindShift),
                actionId: acceptAction(
                  insight.action,
                  essence,
                  localActions,
                  `insight ${n + 1}`,
                  problems,
                ),
              };
            });
            return below(items.length, minInsights, "insights", problems, {
              items,
              claims: review.claims,
              actions: localActions,
            });
          },
        ),
      () => ({ items: [], claims, actions: [...actions] }),
    );
    claims = insights.claims;
    actions.splice(0, actions.length, ...insights.actions);

    /* ── Ключевые концепции ── */
    const [minConcepts, maxConcepts] = COUNTS.concepts;
    const concepts = await optional(
      "concepts",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.concepts",
            tier: "main",
            system,
            schema: conceptsDraft,
            prompt: `${context(scope, claims, true)}
List the key concepts the author introduces or relies on: theories, the author's own models, methods and principles — up to ${maxConcepts}. Include a concept only if the sources name or describe it. For each:
- name: the concept's name as the sources give it;
- kind: theory, model, method or principle;
- statement: what the concept says (book_fact with evidence when an excerpt describes it, otherwise ai_interpretation based on facts);
- explanation: how it works, in simple language (ai_interpretation).`,
          },
          (object) => {
            const problems: string[] = [];
            const drafts = object.concepts.flatMap((c) => [c.statement, c.explanation]);
            const review = reviewDrafts(
              drafts.filter((d): d is ClaimDraft => d !== null),
              claims,
              sources,
            );
            problems.push(...review.problems);
            const items = object.concepts
              .filter((c) => c.name.trim() && review.idOf(c.statement))
              .slice(0, maxConcepts)
              .map((concept, n) => ({
                id: `concept${n + 1}`,
                name: concept.name.trim(),
                kind: concept.kind,
                statement: review.idOf(concept.statement)!,
                explanation: review.idOf(concept.explanation),
                diagram: null,
              }));
            return below(items.length, minConcepts, "concepts", problems, {
              items,
              claims: review.claims,
            });
          },
        ),
      () => ({ items: [], claims }),
    );
    claims = concepts.claims;

    /* ── Психология и философия автора ── */
    const [minBeliefs, maxBeliefs] = COUNTS.beliefs;
    const worldview = await optional(
      "worldview",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.worldview",
            tier: "main",
            system,
            schema: worldviewDraft,
            prompt: `${context(scope, claims, true)}
Describe the author's worldview as it shows in this book:
- lens: how the author looks at the world;
- beliefs: ${minBeliefs} to ${maxBeliefs} beliefs that underlie the book;
- thinkingModel: the way of thinking the author offers the reader.
Use book_fact with evidence where the author states something directly (for example in an interview excerpt); otherwise ai_interpretation based on facts. Describe the book's stance, not the author's private life or personality.`,
          },
          (object) => {
            const problems: string[] = [];
            const drafts = [object.lens, ...object.beliefs, object.thinkingModel];
            const review = reviewDrafts(
              drafts.filter((d): d is ClaimDraft => d !== null),
              claims,
              sources,
            );
            problems.push(...review.problems);
            const beliefs = object.beliefs
              .flatMap((d) => review.idOf(d) ?? [])
              .slice(0, maxBeliefs);
            return below(beliefs.length, minBeliefs, "beliefs", problems, {
              value: {
                lens: review.idOf(object.lens),
                beliefs,
                thinkingModel: review.idOf(object.thinkingModel),
              },
              claims: review.claims,
            });
          },
        ),
      () => ({ value: { lens: null, beliefs: [], thinkingModel: null }, claims }),
    );
    claims = worldview.claims;

    /* ── Критический анализ ── */
    const critique = await optional(
      "critique",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.critique",
            tier: "deep",
            system,
            maxTokens: 8000,
            schema: critiqueDraft,
            prompt: `${context(scope, claims, true)}
Assess the book critically. Fill each list with zero to four claims:
- strengths and weaknesses of the book's argument;
- disputed: statements of the book that are contested;
- unproven: hypotheses the book presents without sufficient evidence;
- outdated: what has aged since publication;
- contradicted: ideas that conflict with later research.
Use external_research, citing its excerpt, for anything reviewers or studies in the sources say. Use critique, with basedOn, for your own evaluation of the book's facts. Do not attribute a criticism to "researchers" or "critics" unless an excerpt contains it; leave "outdated" and "contradicted" empty if the sources give no basis. A critical point must name what exactly in the book it concerns.`,
          },
          (object) => {
            const problems: string[] = [];
            const drafts = CRITIQUE_GROUPS.flatMap((group) => object[group]);
            const review = reviewDrafts(drafts, claims, sources);
            problems.push(...review.problems);
            const value = Object.fromEntries(
              CRITIQUE_GROUPS.map((group) => [
                group,
                object[group].flatMap((d) => review.idOf(d) ?? []),
              ]),
            ) as Content["critique"];
            const total = value.strengths.length + value.weaknesses.length;
            return below(total, 2, "strengths and weaknesses", problems, {
              value,
              claims: review.claims,
            });
          },
        ),
      () => ({
        value: {
          strengths: [],
          weaknesses: [],
          disputed: [],
          unproven: [],
          outdated: [],
          contradicted: [],
        },
        claims,
      }),
    );
    claims = critique.claims;

    /* ── Связь с другими знаниями ── */
    const connections = await optional(
      "connections",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.connections",
            tier: "main",
            system,
            schema: connectionsDraft,
            prompt: `${context(scope, claims, true)}
Place the book among other knowledge:
- theories: up to four established theories or fields the book's ideas overlap with, each with "relation" — how exactly they connect;
- books: up to four other well-known books that complement this one, each with title, author and "relation";
- combinations: up to three ideas from the lists above that work well together, and why.
Relations are ai_interpretation based on this book's claims, or external_research when an excerpt makes the connection. Name only theories and books you are certain exist, with the correct author; if unsure, leave the item out.`,
          },
          (object) => {
            const problems: string[] = [];
            const drafts = [
              ...object.theories.map((t) => t.relation),
              ...object.books.map((b) => b.relation),
              ...object.combinations,
            ];
            const review = reviewDrafts(drafts, claims, sources);
            problems.push(...review.problems);
            const value: Content["connections"] = {
              theories: object.theories.flatMap((t) => {
                const relation = review.idOf(t.relation);
                return relation && t.name.trim()
                  ? [{ name: t.name.trim(), relation }]
                  : [];
              }),
              books: object.books.flatMap((b) => {
                const relation = review.idOf(b.relation);
                return relation && b.title.trim() && b.author.trim()
                  ? [{ title: b.title.trim(), author: b.author.trim(), relation }]
                  : [];
              }),
              combinations: object.combinations.flatMap((d) => review.idOf(d) ?? []),
            };
            return below(
              value.theories.length + value.books.length,
              1,
              "connections",
              problems,
              {
                value,
                claims: review.claims,
              },
            );
          },
        ),
      () => ({ value: { theories: [], books: [], combinations: [] }, claims }),
    );
    claims = connections.claims;

    /* ── Главные выводы ── */
    const [minTakeaways, maxTakeaways] = COUNTS.takeaways;
    const takeaways = await optional(
      "takeaways",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.takeaways",
            tier: "main",
            system,
            schema: takeawaysDraft,
            prompt: `${context(scope, claims, false)}
Write the conclusions a reader should keep:
- main: the single main thought of the book in one sentence (ai_interpretation based on facts);
- items: up to ${maxTakeaways} conclusions worth remembering, each a complete thought that stands on its own (ai_interpretation with basedOn).
Conclusions may build on the ideas and insights above, but each must be worded as a takeaway — what follows for the reader — not as a copy of an earlier claim, and no two may say the same thing.`,
          },
          (object) => {
            const problems: string[] = [];
            const drafts = [object.main, ...object.items].filter(
              (d): d is ClaimDraft => d !== null,
            );
            const review = reviewDrafts(drafts, claims, sources);
            problems.push(...review.problems);
            const items = dropRepeats(
              object.items.filter((d) => review.idOf(d)),
              (d) => d.text,
              [],
              "takeaways",
              problems,
            )
              .slice(0, maxTakeaways)
              .map((d) => review.idOf(d)!);
            return below(items.length, minTakeaways, "takeaways", problems, {
              value: { main: review.idOf(object.main), items },
              claims: review.claims,
            });
          },
        ),
      () => ({ value: { main: null, items: [] }, claims }),
    );
    claims = takeaways.claims;

    /* ── AI-аналитика: оценки и выделенные идеи ── */
    const ideaIds = new Set(ideas.items.map((idea) => idea.id));
    const scores = await optional(
      "scores",
      warnings,
      () =>
        generateChecked(
          ctx.model,
          {
            task: "analysis.scores",
            tier: "deep",
            system,
            schema: scoresDraft,
            prompt: `${context(scope, claims, false)}
Main ideas by id:
${ideas.items.map((idea) => `${idea.id} — ${idea.title}`).join("\n")}

Rate the book from 1 to 10 on each of six dimensions, exactly once each: depth (depth of ideas), practicality (practical value), originality, rigor (how well the argument is supported), relevance (how current it is), difficulty (how hard it is to read; 10 is hardest). For each give "rationale" — a critique claim, based on the claims above, that explains the number. These are your reasoned opinions, not objective ratings, so the rationale must make the reasoning visible.

Then four highlights, exactly once each: strongest (the strongest idea), underrated (the most underrated), disputed (the most disputed), practical (the idea with the most practical potential). Give ideaId when it is one of the main ideas, otherwise null, and "reason" — an ai_interpretation or critique claim explaining the choice.`,
          },
          (object) => {
            const problems: string[] = [];
            const review = reviewDrafts(
              [
                ...object.scores.map((s) => s.rationale),
                ...object.highlights.map((h) => h.reason),
              ],
              claims,
              sources,
            );
            problems.push(...review.problems);
            const scoreItems: Content["scores"] = [];
            for (const dimension of SCORE_DIMENSIONS) {
              const given = object.scores.find((s) => s.dimension === dimension);
              const rationale = given ? review.idOf(given.rationale) : null;
              const valid =
                given &&
                Number.isInteger(given.value) &&
                given.value >= 1 &&
                given.value <= 10;
              if (!given || !rationale || !valid) {
                problems.push(
                  `Score "${dimension}" is missing, out of range or has no grounded rationale.`,
                );
              } else scoreItems.push({ dimension, value: given.value, rationale });
            }
            const highlightItems: Content["highlights"] = [];
            for (const kind of HIGHLIGHT_KINDS) {
              const given = object.highlights.find((h) => h.kind === kind);
              const reason = given ? review.idOf(given.reason) : null;
              if (!given || !reason)
                problems.push(
                  `Highlight "${kind}" is missing or has no grounded reason.`,
                );
              else {
                if (given.ideaId && !ideaIds.has(given.ideaId))
                  problems.push(`Idea ${given.ideaId} does not exist.`);
                highlightItems.push({
                  kind,
                  ideaId: given.ideaId && ideaIds.has(given.ideaId) ? given.ideaId : null,
                  reason,
                });
              }
            }
            // Оценка без объяснения не сохраняется; неполный набор оценок лучше, чем придуманный.
            return below(scoreItems.length, 4, "scores", problems, {
              scores: scoreItems,
              highlights: highlightItems,
              claims: review.claims,
            });
          },
        ),
      () => ({ scores: [], highlights: [], claims }),
    );
    claims = scores.claims;

    const content: Content = {
      structure,
      overview: summary.overview,
      units: summary.units,
      ideas: ideas.items,
      concepts: concepts.items,
      insights: insights.items,
      worldview: worldview.value,
      critique: critique.value,
      connections: connections.value,
      takeaways: takeaways.value,
      scores: scores.scores,
      highlights: scores.highlights,
      actions,
    };
    return { claims, content, warnings };
  },
  apply: (state, analysis) => ({ ...state, analysis }),
};

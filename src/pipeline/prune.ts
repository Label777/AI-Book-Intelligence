/**
 * Удаление неподтверждённых утверждений из готового анализа.
 * Вместе с утверждением уходит всё, что на нём держалось: выводы, потерявшие
 * все основания, и элементы разделов, оставшиеся без главного утверждения.
 */
import type { Claim, Content } from "./schema";

export interface PruneResult {
  claims: Claim[];
  content: Content;
  /** Утверждения, удалённые потому, что исчезли все их основания. */
  cascaded: string[];
}

export function prune(
  claims: Claim[],
  content: Content,
  removeIds: Iterable<string>,
): PruneResult {
  const removed = new Set(removeIds);
  const direct = new Set(removed);

  // Каскад: вывод без оснований и без источников не может оставаться.
  let changed = true;
  while (changed) {
    changed = false;
    for (const claim of claims) {
      if (removed.has(claim.id)) continue;
      if (claim.type === "book_fact" || claim.type === "external_research") continue;
      const hadBasis = claim.basedOn.length > 0;
      const basisLeft = claim.basedOn.some((ref) => !removed.has(ref));
      if (hadBasis && !basisLeft && claim.evidence.length === 0) {
        removed.add(claim.id);
        changed = true;
      }
    }
  }

  const alive = (id: string | null): id is string => id !== null && !removed.has(id);
  const keep = (id: string | null) => (alive(id) ? id : null);
  const list = (ids: string[]) => ids.filter(alive);

  const ideas = content.ideas
    .filter((idea) => alive(idea.statement))
    .map((idea) => ({
      ...idea,
      explanation: keep(idea.explanation),
      importance: keep(idea.importance),
    }));
  const insights = content.insights
    .filter((insight) => alive(insight.essence))
    .map((insight) => ({
      ...insight,
      explanation: keep(insight.explanation),
      example: keep(insight.example),
      mindShift: keep(insight.mindShift),
    }));

  const actions = content.actions.filter((action) => alive(action.claimId));
  const actionIds = new Set(actions.map((action) => action.id));
  const keepAction = (id: string | null) => (id && actionIds.has(id) ? id : null);
  const ideaIds = new Set(ideas.map((idea) => idea.id));

  const next: Content = {
    structure: content.structure,
    overview: {
      problem: keep(content.overview.problem),
      intent: keep(content.overview.intent),
      solution: keep(content.overview.solution),
      audience: keep(content.overview.audience),
    },
    units: content.units.map((unit) => ({
      unitId: unit.unitId,
      facts: list(unit.facts),
      conclusion: keep(unit.conclusion),
      link: keep(unit.link),
    })),
    ideas: ideas.map((idea) => ({ ...idea, actionId: keepAction(idea.actionId) })),
    concepts: content.concepts
      .filter((concept) => alive(concept.statement))
      .map((concept) => ({ ...concept, explanation: keep(concept.explanation) })),
    insights: insights.map((insight) => ({
      ...insight,
      actionId: keepAction(insight.actionId),
    })),
    worldview: {
      lens: keep(content.worldview.lens),
      beliefs: list(content.worldview.beliefs),
      thinkingModel: keep(content.worldview.thinkingModel),
    },
    critique: {
      strengths: list(content.critique.strengths),
      weaknesses: list(content.critique.weaknesses),
      disputed: list(content.critique.disputed),
      unproven: list(content.critique.unproven),
      outdated: list(content.critique.outdated),
      contradicted: list(content.critique.contradicted),
    },
    connections: {
      theories: content.connections.theories.filter((t) => alive(t.relation)),
      books: content.connections.books.filter((b) => alive(b.relation)),
      combinations: list(content.connections.combinations),
    },
    takeaways: {
      main: keep(content.takeaways.main),
      items: list(content.takeaways.items),
    },
    // Оценка без объяснения не хранится.
    scores: content.scores.filter((score) => alive(score.rationale)),
    highlights: content.highlights
      .filter((highlight) => alive(highlight.reason))
      .map((h) => ({
        ...h,
        ideaId: h.ideaId && ideaIds.has(h.ideaId) ? h.ideaId : null,
      })),
    actions: actions.filter(
      (action) =>
        ideas.some((idea) => idea.actionId === action.id) ||
        insights.some((insight) => insight.actionId === action.id),
    ),
  };

  return {
    claims: claims
      .filter((claim) => !removed.has(claim.id))
      .map((claim) => ({
        ...claim,
        basedOn: claim.basedOn.filter((ref) => !removed.has(ref)),
      })),
    content: next,
    cascaded: [...removed].filter((id) => !direct.has(id)),
  };
}

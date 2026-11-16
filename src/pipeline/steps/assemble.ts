/**
 * Шаг 7. Сборка презентации.
 *
 * Чистая функция без модели: из проверенного содержания получается 14–20 слайдов
 * (docs/05-focus-and-mvp.md, раздел 3.3). Слайды ссылаются на утверждения и действия
 * по идентификаторам; своего текста, кроме подписей разделов, в них нет.
 * Раздел, для которого не осталось материала, пропускается — пустых слайдов не бывает.
 */
import { z } from "zod";

import { LIMITS } from "../config";
import type { Step } from "../runner";
import {
  CRITIQUE_GROUPS,
  HORIZONS,
  slideSchema,
  type Action,
  type AnalysisMode,
  type Book,
  type Content,
  type Section,
  type Slide,
  type SlideBlock,
} from "../schema";
import type { Language } from "./shared";
import { need, type AnalysisState } from "./state";

export const assembleOutputSchema = z.object({ slides: z.array(slideSchema) });
export type AssembleOutput = z.infer<typeof assembleOutputSchema>;

type Labels = typeof RU;

const RU = {
  author: "Автор",
  year: "Год первой публикации",
  category: "Категория",
  mainIdea: "Главная идея",
  mode: {
    sources_only: "Анализ по открытым источникам",
    full_text: "Анализ по полному тексту",
  },
  overview: "О чём эта книга",
  problem: "Проблема",
  intent: "Что хотел донести автор",
  solution: "Какое решение предлагает",
  audience: "Кому будет полезна",
  ideas: "Главные идеи",
  explanation: "Простыми словами",
  importance: "Почему это важно",
  chapters: "Разбор по главам",
  themes: "Тематический разбор",
  themesNote:
    "Оглавление книги не подтверждено источниками, поэтому разбор построен по темам. Темы выделены AI.",
  noUnitData: "В источниках нет сведений о содержании этой части.",
  conclusion: "Главный вывод",
  link: "Связь с предыдущим",
  concepts: "Ключевые концепции",
  conceptKind: {
    theory: "Теория",
    model: "Модель",
    method: "Методика",
    principle: "Принцип",
  },
  howItWorks: "Как это работает",
  insights: "Самые ценные инсайты",
  example: "Пример из жизни",
  mindShift: "Как это меняет мышление",
  practice: "Практическое применение",
  context: { work: "В работе", business: "В бизнесе", life: "В повседневной жизни" },
  worldview: "Психология и философия автора",
  lens: "Как автор смотрит на мир",
  beliefs: "Убеждения в основе книги",
  thinkingModel: "Какую модель мышления предлагает",
  critique: "Критический анализ",
  critiqueGroup: {
    strengths: "Сильные стороны",
    weaknesses: "Слабые стороны",
    disputed: "Спорные утверждения",
    unproven: "Недоказанные гипотезы",
    outdated: "Что устарело",
    contradicted: "Что противоречит исследованиям",
  },
  connections: "Связь с другими знаниями",
  theories: "Пересекается с теориями",
  books: "Книги, которые дополняют",
  combinations: "Что можно объединить",
  takeaways: "Главные выводы",
  mainThought: "Одна главная мысль",
  plan: "План внедрения",
  horizon: { "24h": "Первые 24 часа", "7d": "Первые 7 дней", "30d": "Первые 30 дней" },
  scores: "AI-аналитика",
  scoresNote: "Оценки — мнение AI с объяснением, а не научный рейтинг.",
  dimension: {
    depth: "Глубина идей",
    practicality: "Практическая ценность",
    originality: "Оригинальность",
    rigor: "Достоверность аргументации",
    relevance: "Актуальность",
    difficulty: "Сложность восприятия",
  },
  highlight: {
    strongest: "Самая сильная идея",
    underrated: "Самая недооценённая идея",
    disputed: "Самая спорная идея",
    practical: "Идея с наибольшим практическим потенциалом",
  },
  part: (title: string, n: number, total: number) =>
    total > 1 ? `${title} (${n} из ${total})` : title,
};

const EN: Labels = {
  author: "Author",
  year: "First published",
  category: "Category",
  mainIdea: "Main idea",
  mode: {
    sources_only: "Analysis based on public sources",
    full_text: "Analysis based on the full text",
  },
  overview: "What this book is about",
  problem: "The problem",
  intent: "What the author wants to convey",
  solution: "The answer it offers",
  audience: "Who will benefit",
  ideas: "Main ideas",
  explanation: "In simple words",
  importance: "Why it matters",
  chapters: "Chapter by chapter",
  themes: "Theme by theme",
  themesNote:
    "The table of contents could not be confirmed from sources, so the analysis is organised by themes. The themes were identified by AI.",
  noUnitData: "The sources say nothing about the content of this part.",
  conclusion: "Main takeaway",
  link: "Link to the previous part",
  concepts: "Key concepts",
  conceptKind: {
    theory: "Theory",
    model: "Model",
    method: "Method",
    principle: "Principle",
  },
  howItWorks: "How it works",
  insights: "Most valuable insights",
  example: "Real-life example",
  mindShift: "How it changes thinking",
  practice: "Putting it into practice",
  context: { work: "At work", business: "In business", life: "In everyday life" },
  worldview: "The author's psychology and philosophy",
  lens: "How the author sees the world",
  beliefs: "Beliefs behind the book",
  thinkingModel: "The way of thinking it offers",
  critique: "Critical analysis",
  critiqueGroup: {
    strengths: "Strengths",
    weaknesses: "Weaknesses",
    disputed: "Disputed claims",
    unproven: "Unproven hypotheses",
    outdated: "What has aged",
    contradicted: "What research contradicts",
  },
  connections: "Links to other knowledge",
  theories: "Overlapping theories",
  books: "Books that complement it",
  combinations: "Ideas that combine well",
  takeaways: "Key takeaways",
  mainThought: "The one main thought",
  plan: "Action plan",
  horizon: { "24h": "First 24 hours", "7d": "First 7 days", "30d": "First 30 days" },
  scores: "AI analytics",
  scoresNote: "Scores are the AI's reasoned opinion, not a scientific rating.",
  dimension: {
    depth: "Depth of ideas",
    practicality: "Practical value",
    originality: "Originality",
    rigor: "Soundness of argument",
    relevance: "Relevance today",
    difficulty: "Reading difficulty",
  },
  highlight: {
    strongest: "Strongest idea",
    underrated: "Most underrated idea",
    disputed: "Most disputed idea",
    practical: "Idea with the most practical potential",
  },
  part: (title, n, total) => (total > 1 ? `${title} (${n} of ${total})` : title),
};

const LABELS: Record<Language, Labels> = { ru: RU, en: EN };

/** Делит список на почти равные части не длиннее `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return [];
  const parts = Math.ceil(items.length / size);
  const per = Math.ceil(items.length / parts);
  return Array.from({ length: parts }, (_, i) => items.slice(i * per, (i + 1) * per));
}

const PER_SLIDE = {
  ideas: 6,
  units: 4,
  insights: 4,
  actions: 10,
  critique: 8,
  planPerHorizon: 4,
};

interface Draft {
  section: Section;
  template: string;
  title: string;
  blocks: SlideBlock[];
}

export function assembleSlides(input: {
  book: Book;
  mode: AnalysisMode;
  content: Content;
  language: Language;
}): Slide[] {
  const { book, mode, content } = input;
  const t = LABELS[input.language];
  const claim = (
    claimId: string | null,
    role: string | null = null,
    group: string | null = null,
  ) => (claimId ? [{ kind: "claim" as const, group, role, claimId }] : []);
  const roles = (pairs: [string | null, string | null][]) =>
    pairs.flatMap(([role, claimId]) => (claimId ? [{ role, claimId }] : []));
  const actionById = new Map(content.actions.map((action) => [action.id, action]));
  const actions = content.actions;

  const before: Draft[] = [];
  const after: Draft[] = [];

  /* 1. Обложка */
  const cover: SlideBlock[] = [
    { kind: "meta", group: null, label: t.author, value: book.authors.join(", ") },
  ];
  if (book.firstPublishYear) {
    cover.push({
      kind: "meta",
      group: null,
      label: t.year,
      value: String(book.firstPublishYear),
    });
  }
  if (book.subjects.length > 0) {
    cover.push({
      kind: "meta",
      group: null,
      label: t.category,
      value: book.subjects.slice(0, 3).join(", "),
    });
  }
  cover.push(...claim(content.takeaways.main, t.mainIdea));
  cover.push({ kind: "note", group: null, text: t.mode[mode] });
  before.push({ section: "cover", template: "cover", title: book.title, blocks: cover });

  /* 2. О чём книга */
  const overview = [
    ...claim(content.overview.problem, t.problem),
    ...claim(content.overview.intent, t.intent),
    ...claim(content.overview.solution, t.solution),
    ...claim(content.overview.audience, t.audience),
  ];
  if (overview.length > 0) {
    before.push({
      section: "overview",
      template: "overview",
      title: t.overview,
      blocks: overview,
    });
  }

  /* 3. Главные идеи */
  const ideaParts = chunk(content.ideas, PER_SLIDE.ideas);
  ideaParts.forEach((part, i) =>
    before.push({
      section: "ideas",
      template: "ideas",
      title: t.part(t.ideas, i + 1, ideaParts.length),
      blocks: part.map((idea) => ({
        kind: "item",
        group: null,
        title: idea.title,
        subtitle: null,
        claims: roles([
          [null, idea.statement],
          [t.explanation, idea.explanation],
          [t.importance, idea.importance],
        ]),
        actionId: idea.actionId && actionById.has(idea.actionId) ? idea.actionId : null,
      })),
    }),
  );

  /* 4. Разбор по главам или темам */
  const unitTitle = content.structure.kind === "chapters" ? t.chapters : t.themes;
  const unitTitles = new Map(
    content.structure.units.map((unit) => [unit.id, unit.title]),
  );
  // Не больше двух слайдов: в длинном оглавлении главы показываются раскрывающимися карточками.
  const unitParts = chunk(
    content.units,
    Math.max(PER_SLIDE.units, Math.ceil(content.units.length / 2)),
  );
  unitParts.forEach((part, i) => {
    const blocks: SlideBlock[] = [];
    if (i === 0 && content.structure.kind === "themes") {
      blocks.push({ kind: "note", group: null, text: t.themesNote });
    }
    for (const unit of part) {
      const title = unitTitles.get(unit.unitId) ?? unit.unitId;
      blocks.push({
        kind: "item",
        group: null,
        title,
        subtitle: unit.facts.length === 0 ? t.noUnitData : null,
        claims: roles([
          ...unit.facts.map((id): [null, string] => [null, id]),
          [t.conclusion, unit.conclusion],
          [t.link, unit.link],
        ]),
        actionId: null,
      });
    }
    before.push({
      section: "units",
      template: "chapters",
      title: t.part(unitTitle, i + 1, unitParts.length),
      blocks,
    });
  });

  /* 6. Инсайты */
  const insightParts = chunk(content.insights, PER_SLIDE.insights);
  let insightNumber = 0;
  insightParts.forEach((part, i) =>
    after.push({
      section: "insights",
      template: "insight",
      title: t.part(t.insights, i + 1, insightParts.length),
      blocks: part.map((insight) => ({
        kind: "item",
        group: null,
        title: String(++insightNumber),
        subtitle: null,
        claims: roles([
          [null, insight.essence],
          [t.explanation, insight.explanation],
          [t.example, insight.example],
          [t.mindShift, insight.mindShift],
        ]),
        actionId:
          insight.actionId && actionById.has(insight.actionId) ? insight.actionId : null,
      })),
    }),
  );

  /* 7. Практическое применение: все действия, сгруппированные по сфере */
  const byContext = (["work", "business", "life"] as const).flatMap((context) =>
    actions
      .filter((action) => action.context === context)
      .map((action): SlideBlock => ({
        kind: "action",
        group: t.context[context],
        actionId: action.id,
      })),
  );
  const practiceParts = chunk(byContext, PER_SLIDE.actions);
  practiceParts.forEach((part, i) =>
    after.push({
      section: "practice",
      template: "practice",
      title: t.part(t.practice, i + 1, practiceParts.length),
      blocks: part,
    }),
  );

  /* 8. Мировоззрение автора */
  const worldview = [
    ...claim(content.worldview.lens, t.lens),
    ...content.worldview.beliefs.flatMap((id) => claim(id, null, t.beliefs)),
    ...claim(content.worldview.thinkingModel, t.thinkingModel),
  ];
  if (worldview.length > 0) {
    after.push({
      section: "worldview",
      template: "worldview",
      title: t.worldview,
      blocks: worldview,
    });
  }

  /* 9. Критический анализ */
  const critiqueBlocks = (groups: readonly (typeof CRITIQUE_GROUPS)[number][]) =>
    groups.flatMap((group) =>
      content.critique[group].flatMap((id) => claim(id, null, t.critiqueGroup[group])),
    );
  const allCritique = critiqueBlocks(CRITIQUE_GROUPS);
  const critiqueParts =
    allCritique.length > PER_SLIDE.critique
      ? [
          critiqueBlocks(["strengths", "weaknesses"]),
          critiqueBlocks(["disputed", "unproven", "outdated", "contradicted"]),
        ].filter((blocks) => blocks.length > 0)
      : allCritique.length > 0
        ? [allCritique]
        : [];
  critiqueParts.forEach((blocks, i) =>
    after.push({
      section: "critique",
      template: "critique",
      title: t.part(t.critique, i + 1, critiqueParts.length),
      blocks,
    }),
  );

  /* 10. Связи */
  const connections: SlideBlock[] = [
    ...content.connections.theories.map((theory): SlideBlock => ({
      kind: "item",
      group: t.theories,
      title: theory.name,
      subtitle: null,
      claims: [{ role: null, claimId: theory.relation }],
      actionId: null,
    })),
    ...content.connections.books.map((other): SlideBlock => ({
      kind: "item",
      group: t.books,
      title: other.title,
      subtitle: other.author,
      claims: [{ role: null, claimId: other.relation }],
      actionId: null,
    })),
    ...content.connections.combinations.flatMap((id) => claim(id, null, t.combinations)),
  ];
  if (connections.length > 0) {
    after.push({
      section: "connections",
      template: "connections",
      title: t.connections,
      blocks: connections,
    });
  }

  /* 11. Главные выводы */
  const takeaways = [
    ...claim(content.takeaways.main, t.mainThought),
    ...content.takeaways.items.flatMap((id) => claim(id)),
  ];
  if (takeaways.length > 0) {
    after.push({
      section: "takeaways",
      template: "takeaways",
      title: t.takeaways,
      blocks: takeaways,
    });
  }

  /* 12. План внедрения: действия по срокам */
  const plan = HORIZONS.flatMap((horizon) =>
    actions
      .filter((action: Action) => action.horizon === horizon)
      .slice(0, PER_SLIDE.planPerHorizon)
      .map((action): SlideBlock => ({
        kind: "action",
        group: t.horizon[horizon],
        actionId: action.id,
      })),
  );
  if (plan.length > 0)
    after.push({ section: "plan", template: "plan", title: t.plan, blocks: plan });

  /* 13. AI-аналитика */
  if (content.scores.length > 0 || content.highlights.length > 0) {
    const ideaTitle = new Map(content.ideas.map((idea) => [idea.id, idea.title]));
    after.push({
      section: "scores",
      template: "scores",
      title: t.scores,
      blocks: [
        { kind: "note", group: null, text: t.scoresNote },
        ...content.scores.map((score): SlideBlock => ({
          kind: "score",
          group: null,
          dimension: score.dimension,
          label: t.dimension[score.dimension],
          value: score.value,
          claimId: score.rationale,
        })),
        ...content.highlights.map((highlight): SlideBlock => ({
          kind: "item",
          group: null,
          title: t.highlight[highlight.kind],
          subtitle: highlight.ideaId ? (ideaTitle.get(highlight.ideaId) ?? null) : null,
          claims: [{ role: null, claimId: highlight.reason }],
          actionId: null,
        })),
      ],
    });
  }

  /* 5. Концепции — в последнюю очередь: им достаётся то, что осталось от предела в 20 слайдов */
  const room = Math.max(1, LIMITS.maxSlides - before.length - after.length);
  const ownSlides = Math.min(3, room, content.concepts.length);
  const conceptSlides: Draft[] = [];
  const conceptClaims = (c: Content["concepts"][number]) =>
    roles([
      [null, c.statement],
      [t.howItWorks, c.explanation],
    ]);
  content.concepts.forEach((concept, i) => {
    const merged = i >= ownSlides - 1 && content.concepts.length > ownSlides;
    if (!merged) {
      conceptSlides.push({
        section: "concepts",
        template: "concept",
        title: concept.name,
        blocks: [
          {
            kind: "meta",
            group: null,
            label: t.concepts,
            value: t.conceptKind[concept.kind],
          },
          ...conceptClaims(concept).map((c): SlideBlock => ({
            kind: "claim",
            group: null,
            role: c.role,
            claimId: c.claimId,
          })),
          ...(concept.diagram
            ? [{ kind: "diagram" as const, group: null, diagram: concept.diagram }]
            : []),
        ],
      });
      return;
    }
    // Концепции, которым не хватило отдельного слайда, объединяются на одном — без схем.
    let shared = conceptSlides.find((slide) => slide.template === "concepts");
    if (!shared) {
      shared = {
        section: "concepts",
        template: "concepts",
        title: t.concepts,
        blocks: [],
      };
      conceptSlides.push(shared);
    }
    shared.blocks.push({
      kind: "item",
      group: null,
      title: concept.name,
      subtitle: t.conceptKind[concept.kind],
      claims: conceptClaims(concept),
      actionId: null,
    });
  });

  return [...before, ...conceptSlides, ...after]
    .slice(0, LIMITS.maxSlides)
    .map((slide, i) => ({ id: `sl${i + 1}`, ...slide }));
}

/** Содержание с подставленными схемами концепций. */
export function withDiagrams(
  content: Content,
  diagrams: { conceptId: string; diagram: Content["concepts"][number]["diagram"] }[],
): Content {
  const byConcept = new Map(diagrams.map((d) => [d.conceptId, d.diagram]));
  return {
    ...content,
    concepts: content.concepts.map((concept) => ({
      ...concept,
      diagram: byConcept.get(concept.id) ?? concept.diagram,
    })),
  };
}

export const assembleStep: Step<AnalysisState, AssembleOutput> = {
  name: "assemble",
  version: "1",
  tiers: [],
  schema: assembleOutputSchema,
  input: (state) => ({
    book: state.book,
    mode: state.request.mode,
    language: state.request.language,
    content: state.analysis?.content,
    diagrams: state.visuals?.diagrams,
  }),
  async run(state) {
    const { content } = need(state, "analysis");
    const { diagrams } = need(state, "visuals");
    return {
      slides: assembleSlides({
        book: need(state, "book"),
        mode: state.request.mode,
        language: state.request.language,
        content: withDiagrams(content, diagrams),
      }),
    };
  },
  apply: (state, assembled) => ({ ...state, assembled }),
};

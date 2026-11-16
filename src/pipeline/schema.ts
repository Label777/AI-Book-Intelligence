/**
 * Схемы данных AI-пайплайна (docs/03-architecture.md, раздел 5).
 *
 * Единица хранения — утверждение (claim) с типом и ссылками на источники.
 * Разделы анализа и слайды не содержат собственного текста утверждений:
 * они ссылаются на утверждения по идентификаторам.
 */
import { z } from "zod";

import { PROVENANCE_TYPES } from "@/lib/provenance";

export const ANALYSIS_MODES = ["sources_only", "full_text"] as const;
export const analysisModeSchema = z.enum(ANALYSIS_MODES);
export type AnalysisMode = z.infer<typeof analysisModeSchema>;

export const provenanceTypeSchema = z.enum(PROVENANCE_TYPES);

/* ───────── Книга ───────── */

/** Книга, которую пользователь подтвердил на шаге идентификации (этап 5). */
export const bookSchema = z.object({
  workId: z.string().min(1),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)).min(1),
  firstPublishYear: z.number().int().nullable(),
  /** Аннотация из каталога, если есть. */
  description: z.string().nullable(),
  subjects: z.array(z.string()),
});
export type Book = z.infer<typeof bookSchema>;

/* ───────── Источники ───────── */

export const SOURCE_KINDS = [
  "description",
  "toc",
  "encyclopedia",
  "review",
  "interview",
  "research",
  "user_text",
  "other",
] as const;
export const sourceKindSchema = z.enum(SOURCE_KINDS);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const RELIABILITY = ["high", "medium", "low"] as const;

export const excerptSchema = z.object({
  id: z.string().min(1),
  /** Дословный фрагмент источника. Приходит от поиска или из каталога, модель его не пишет. */
  text: z.string().min(1),
});
export type Excerpt = z.infer<typeof excerptSchema>;

export const sourceSchema = z.object({
  id: z.string().min(1),
  kind: sourceKindSchema,
  title: z.string().min(1),
  url: z.string().nullable(),
  /** Домен без www — по нему считается независимость источников. */
  domain: z.string().nullable(),
  retrievedAt: z.string().min(1),
  reliability: z.enum(RELIABILITY),
  excerpts: z.array(excerptSchema),
});
export type Source = z.infer<typeof sourceSchema>;

export const COVERAGE_LEVELS = ["sufficient", "limited", "insufficient"] as const;

/** Отчёт о покрытии: что удалось найти о книге и хватает ли этого для анализа. */
export const coverageSchema = z.object({
  level: z.enum(COVERAGE_LEVELS),
  hasDescription: z.boolean(),
  hasVerifiedToc: z.boolean(),
  /** Число независимых (с разных доменов) источников о содержании книги. */
  independentContentSources: z.number().int(),
  hasCriticism: z.boolean(),
  byKind: z.record(z.string(), z.number().int()),
  /** Чего не хватает — формулировки для показа пользователю. */
  missing: z.array(z.string()),
});
export type Coverage = z.infer<typeof coverageSchema>;

/* ───────── Утверждения ───────── */

export const evidenceSchema = z.object({
  sourceId: z.string().min(1),
  excerptId: z.string().nullable(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const quoteSchema = z.object({
  text: z.string().min(1),
  excerptId: z.string().min(1),
});

export const VERIFICATION = [
  "unverified",
  "supported",
  "partial",
  "unsupported",
] as const;

export const claimSchema = z.object({
  id: z.string().min(1),
  type: provenanceTypeSchema,
  text: z.string().min(1),
  /** Источники: обязательны для фактов и внешних исследований. */
  evidence: z.array(evidenceSchema),
  /** Утверждения, на которые опирается вывод: обязательны для интерпретаций и критики. */
  basedOn: z.array(z.string()),
  /** Дословная цитата — только при точном совпадении с выдержкой. */
  quote: quoteSchema.nullable(),
  verification: z.enum(VERIFICATION),
  /** Если проверка фактов понизила утверждение, здесь его исходный тип. */
  downgradedFrom: provenanceTypeSchema.nullable(),
});
export type Claim = z.infer<typeof claimSchema>;

/**
 * Черновик утверждения — то, что возвращает модель.
 * `key` — метка внутри одного ответа: по ней другие черновики ссылаются на этот.
 * В `basedOn` допустимы и такие метки, и идентификаторы уже сохранённых утверждений.
 *
 * В схеме нет полей, допускающих null: структурированный вывод Claude API ограничивает
 * число таких полей на запрос, а черновик повторяется в схемах десятки раз.
 * Отсутствие значения передаётся пустой строкой.
 */
export const claimDraftSchema = z.object({
  key: z.string(),
  type: provenanceTypeSchema,
  text: z.string(),
  evidence: z.array(z.object({ sourceId: z.string(), excerptId: z.string() })),
  basedOn: z.array(z.string()),
  /** Дословный фрагмент одной из указанных выдержек или пустая строка. */
  quote: z.string(),
});
export type ClaimDraft = z.infer<typeof claimDraftSchema>;

/** Черновик после разбора: пустые строки заменены на null, цитата привязана к выдержке. */
export type ClaimInput = Pick<
  Claim,
  "type" | "text" | "evidence" | "basedOn" | "quote"
> & {
  key: string;
};

/* ───────── Действия ───────── */

export const HORIZONS = ["24h", "7d", "30d"] as const;
export const ACTION_CONTEXTS = ["work", "business", "life"] as const;

/** «Что мне с этим делать»: конкретный шаг, а не совет общего вида. */
export const actionDraftSchema = z.object({
  /** Формулировка шага целиком. */
  text: z.string(),
  /** Над чем совершается действие. */
  object: z.string(),
  /** Когда или при каком условии. */
  when: z.string(),
  horizon: z.enum(HORIZONS),
  context: z.enum(ACTION_CONTEXTS),
});
export type ActionDraft = z.infer<typeof actionDraftSchema>;

export const actionSchema = actionDraftSchema.extend({
  id: z.string().min(1),
  /** Утверждение, из которого следует действие. */
  claimId: z.string().min(1),
});
export type Action = z.infer<typeof actionSchema>;

/* ───────── Схемы для слайдов концепций ───────── */

export const DIAGRAM_TYPES = [
  "cycle",
  "pyramid",
  "matrix",
  "flow",
  "comparison",
  "tree",
] as const;

/**
 * Модель выбирает тип схемы и заполняет подписи, рисует компонент интерфейса.
 * Структура одна на все типы, требования к числу элементов проверяет код (checks/diagram.ts).
 */
export const diagramSchema = z.object({
  type: z.enum(DIAGRAM_TYPES),
  title: z.string(),
  /** Элементы по порядку: шаги цикла или потока, уровни пирамиды, квадранты, строки, ветви. */
  items: z.array(z.object({ label: z.string(), note: z.string().nullable() })),
  /** Подписи осей матрицы или названия колонок сравнения; для остальных типов — пусто. */
  axes: z.array(z.string()),
});
export type Diagram = z.infer<typeof diagramSchema>;

/* ───────── Содержание анализа ───────── */

const id = z.string().min(1);
const claimRef = z.string().min(1);

export const structureSchema = z.object({
  /** `chapters` — только если оглавление подтверждено; иначе тематический разбор. */
  kind: z.enum(["chapters", "themes"]),
  verified: z.boolean(),
  tocSourceIds: z.array(z.string()),
  units: z.array(z.object({ id, title: z.string().min(1) })),
});
export type Structure = z.infer<typeof structureSchema>;

export const overviewSchema = z.object({
  problem: claimRef.nullable(),
  intent: claimRef.nullable(),
  solution: claimRef.nullable(),
  audience: claimRef.nullable(),
});

export const unitSummarySchema = z.object({
  unitId: id,
  /** Краткое содержание главы или темы — факты. */
  facts: z.array(claimRef),
  /** Главный вывод — интерпретация. */
  conclusion: claimRef.nullable(),
  /** Связь с предыдущей главой или темой. */
  link: claimRef.nullable(),
});

export const ideaSchema = z.object({
  id,
  title: z.string().min(1),
  statement: claimRef,
  explanation: claimRef.nullable(),
  importance: claimRef.nullable(),
  actionId: z.string().nullable(),
});

export const CONCEPT_KINDS = ["theory", "model", "method", "principle"] as const;

export const conceptSchema = z.object({
  id,
  name: z.string().min(1),
  kind: z.enum(CONCEPT_KINDS),
  statement: claimRef,
  explanation: claimRef.nullable(),
  diagram: diagramSchema.nullable(),
});

export const insightSchema = z.object({
  id,
  essence: claimRef,
  explanation: claimRef.nullable(),
  example: claimRef.nullable(),
  mindShift: claimRef.nullable(),
  actionId: z.string().nullable(),
});

export const worldviewSchema = z.object({
  lens: claimRef.nullable(),
  beliefs: z.array(claimRef),
  thinkingModel: claimRef.nullable(),
});

export const critiqueSchema = z.object({
  strengths: z.array(claimRef),
  weaknesses: z.array(claimRef),
  disputed: z.array(claimRef),
  unproven: z.array(claimRef),
  outdated: z.array(claimRef),
  contradicted: z.array(claimRef),
});
export const CRITIQUE_GROUPS = [
  "strengths",
  "weaknesses",
  "disputed",
  "unproven",
  "outdated",
  "contradicted",
] as const;

export const connectionsSchema = z.object({
  theories: z.array(z.object({ name: z.string().min(1), relation: claimRef })),
  books: z.array(
    z.object({ title: z.string().min(1), author: z.string().min(1), relation: claimRef }),
  ),
  combinations: z.array(claimRef),
});

export const takeawaysSchema = z.object({
  main: claimRef.nullable(),
  items: z.array(claimRef),
});

export const SCORE_DIMENSIONS = [
  "depth",
  "practicality",
  "originality",
  "rigor",
  "relevance",
  "difficulty",
] as const;

export const scoreSchema = z.object({
  dimension: z.enum(SCORE_DIMENSIONS),
  /** Оценка AI по шкале 1–10. Это мнение модели с объяснением, а не научный рейтинг. */
  value: z.number().int().min(1).max(10),
  rationale: claimRef,
});

export const HIGHLIGHT_KINDS = [
  "strongest",
  "underrated",
  "disputed",
  "practical",
] as const;

export const highlightSchema = z.object({
  kind: z.enum(HIGHLIGHT_KINDS),
  /** Идея из раздела «Главные идеи», если выделение относится к одной из них. */
  ideaId: z.string().nullable(),
  reason: claimRef,
});

export const contentSchema = z.object({
  structure: structureSchema,
  overview: overviewSchema,
  units: z.array(unitSummarySchema),
  ideas: z.array(ideaSchema),
  concepts: z.array(conceptSchema),
  insights: z.array(insightSchema),
  worldview: worldviewSchema,
  critique: critiqueSchema,
  connections: connectionsSchema,
  takeaways: takeawaysSchema,
  scores: z.array(scoreSchema),
  highlights: z.array(highlightSchema),
  actions: z.array(actionSchema),
});
export type Content = z.infer<typeof contentSchema>;

/* ───────── Слайды ───────── */

export const SECTIONS = [
  "cover",
  "overview",
  "ideas",
  "units",
  "concepts",
  "insights",
  "practice",
  "worldview",
  "critique",
  "connections",
  "takeaways",
  "plan",
  "scores",
] as const;
export type Section = (typeof SECTIONS)[number];

/**
 * Блок слайда. Список плоский: вложенность передаётся подписью группы (`group`),
 * например «Сильные стороны» или «Первые 24 часа».
 */
export const slideBlockSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("meta"),
    group: z.string().nullable(),
    label: z.string(),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("claim"),
    group: z.string().nullable(),
    /** Подпись роли: «Проблема», «Пример из жизни» и т. п. */
    role: z.string().nullable(),
    claimId: claimRef,
  }),
  z.object({
    kind: z.literal("item"),
    group: z.string().nullable(),
    title: z.string(),
    subtitle: z.string().nullable(),
    claims: z.array(z.object({ role: z.string().nullable(), claimId: claimRef })),
    actionId: z.string().nullable(),
  }),
  z.object({
    kind: z.literal("action"),
    group: z.string().nullable(),
    actionId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("diagram"),
    group: z.string().nullable(),
    diagram: diagramSchema,
  }),
  z.object({
    kind: z.literal("score"),
    group: z.string().nullable(),
    dimension: z.enum(SCORE_DIMENSIONS),
    label: z.string(),
    value: z.number().int(),
    claimId: claimRef,
  }),
  z.object({ kind: z.literal("note"), group: z.string().nullable(), text: z.string() }),
]);
export type SlideBlock = z.infer<typeof slideBlockSchema>;

export const slideSchema = z.object({
  id: z.string().min(1),
  section: z.enum(SECTIONS),
  /** Имя шаблона из docs/02-ux-ui.md, раздел 4.4. */
  template: z.string().min(1),
  title: z.string().min(1),
  blocks: z.array(slideBlockSchema),
});
export type Slide = z.infer<typeof slideSchema>;

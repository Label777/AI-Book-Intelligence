/**
 * Сборка готового анализа вручную. Анализ пишется как данные: источники с выдержками,
 * утверждения четырёх типов, действия и слайды. Проверку корректности делает validate.ts.
 */
import type { PresentationData } from "@/analysis/types";
import type {
  Action,
  Claim,
  Coverage,
  Diagram,
  Section,
  Slide,
  SlideBlock,
  Source,
} from "@/pipeline/schema";

type SourceMeta = Pick<Source, "kind" | "title" | "url" | "reliability">;
type ActionSpec = Omit<Action, "id">;

export class AnalysisBuilder {
  readonly sources: Source[] = [];
  readonly claims: Claim[] = [];
  readonly actions: Action[] = [];
  readonly slides: Slide[] = [];

  constructor(private readonly retrievedAt: string) {}

  /** Источник и его выдержки: ключ — идентификатор выдержки внутри источника. */
  source(id: string, meta: SourceMeta, excerpts: Record<string, string>): this {
    const domain = meta.url ? new URL(meta.url).hostname.replace(/^www\./, "") : null;
    this.sources.push({
      id,
      ...meta,
      domain,
      retrievedAt: this.retrievedAt,
      excerpts: Object.entries(excerpts).map(([key, text]) => ({
        id: `${id}#${key}`,
        text,
      })),
    });
    return this;
  }

  private push(claim: Omit<Claim, "quote" | "downgradedFrom">): this {
    this.claims.push({ ...claim, quote: null, downgradedFrom: null });
    return this;
  }

  /** Ссылки на выдержки пишутся как «источник#выдержка». */
  private evidence(refs: string[]): Claim["evidence"] {
    return refs.map((ref) => ({ sourceId: ref.split("#")[0], excerptId: ref }));
  }

  /** Что говорится в книге — по источникам о ней. */
  fact(id: string, text: string, refs: string[]): this {
    return this.push({
      id,
      type: "book_fact",
      text,
      evidence: this.evidence(refs),
      basedOn: [],
      verification: "supported",
    });
  }

  /** Сведения за пределами книги: рецензии, биография автора, другие работы. */
  research(id: string, text: string, refs: string[]): this {
    return this.push({
      id,
      type: "external_research",
      text,
      evidence: this.evidence(refs),
      basedOn: [],
      verification: "supported",
    });
  }

  /** Вывод AI на основе других утверждений. */
  ai(id: string, text: string, basedOn: string[]): this {
    return this.push({
      id,
      type: "ai_interpretation",
      text,
      evidence: [],
      basedOn,
      verification: "unverified",
    });
  }

  /** Критический вывод с аргументацией. */
  critique(id: string, text: string, basedOn: string[]): this {
    return this.push({
      id,
      type: "critique",
      text,
      evidence: [],
      basedOn,
      verification: "unverified",
    });
  }

  action(id: string, spec: ActionSpec): this {
    this.actions.push({ id, ...spec });
    return this;
  }

  slide(section: Section, template: string, title: string, blocks: SlideBlock[]): this {
    this.slides.push({
      id: `slide-${this.slides.length + 1}`,
      section,
      template,
      title,
      blocks,
    });
    return this;
  }

  build(
    meta: Pick<PresentationData, "analysisId" | "book" | "mode" | "createdAt"> & {
      coverage: Omit<Coverage, "byKind" | "independentContentSources">;
      method: string;
    },
  ): PresentationData {
    const byKind: Record<string, number> = {};
    for (const source of this.sources)
      byKind[source.kind] = (byKind[source.kind] ?? 0) + 1;
    const domains = new Set(this.sources.map((source) => source.domain).filter(Boolean));
    const checked = this.claims.filter(
      (claim) => claim.type === "book_fact" || claim.type === "external_research",
    ).length;

    return {
      analysisId: meta.analysisId,
      book: meta.book,
      mode: meta.mode,
      createdAt: meta.createdAt,
      slides: this.slides,
      claims: Object.fromEntries(this.claims.map((claim) => [claim.id, claim])),
      actions: Object.fromEntries(this.actions.map((action) => [action.id, action])),
      sources: this.sources,
      coverage: { ...meta.coverage, byKind, independentContentSources: domains.size },
      report: {
        checked,
        supported: checked,
        downgraded: 0,
        removed: 0,
        cascaded: 0,
        quotes: 0,
        slides: this.slides.length,
        missingSections: [],
        warnings: [],
        publishable: true,
        reasons: [],
      },
      editorial: { preparedAt: meta.createdAt, method: meta.method },
    };
  }
}

/* Блоки слайдов — короткие конструкторы. */

export const meta = (
  label: string,
  value: string,
  group: string | null = null,
): SlideBlock => ({
  kind: "meta",
  group,
  label,
  value,
});

export const claim = (
  claimId: string,
  role: string | null = null,
  group: string | null = null,
): SlideBlock => ({ kind: "claim", group, role, claimId });

export const item = (
  title: string,
  subtitle: string | null,
  claims: [role: string | null, claimId: string][],
  actionId: string | null = null,
  group: string | null = null,
): SlideBlock => ({
  kind: "item",
  group,
  title,
  subtitle,
  claims: claims.map(([role, claimId]) => ({ role, claimId })),
  actionId,
});

export const act = (actionId: string, group: string | null = null): SlideBlock => ({
  kind: "action",
  group,
  actionId,
});

export const diagram = (value: Diagram, group: string | null = null): SlideBlock => ({
  kind: "diagram",
  group,
  diagram: value,
});

export const note = (text: string, group: string | null = null): SlideBlock => ({
  kind: "note",
  group,
  text,
});

export const score = (
  dimension: Extract<SlideBlock, { kind: "score" }>["dimension"],
  label: string,
  value: number,
  claimId: string,
): SlideBlock => ({ kind: "score", group: null, dimension, label, value, claimId });

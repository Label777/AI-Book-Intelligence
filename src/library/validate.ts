import type { PresentationData } from "@/analysis/types";
import { checkDiagram } from "@/pipeline/checks/diagram";
import {
  actionSchema,
  claimSchema,
  SECTIONS,
  slideSchema,
  sourceSchema,
} from "@/pipeline/schema";

/**
 * Проверка готового анализа: схема данных, ссылки между утверждениями, источниками
 * и слайдами, правила происхождения и полнота разделов. Возвращает список проблем.
 */
export function validateAnalysis(data: PresentationData): string[] {
  const problems: string[] = [];
  const add = (text: string) => problems.push(text);

  for (const source of data.sources) {
    const parsed = sourceSchema.safeParse(source);
    if (!parsed.success) add(`Источник ${source.id}: ${parsed.error.issues[0]?.message}`);
    if (source.url && !/^https:\/\//.test(source.url))
      add(`Источник ${source.id}: адрес не https`);
  }
  const excerpts = new Set(data.sources.flatMap((s) => s.excerpts.map((e) => e.id)));
  const sourceIds = new Set(data.sources.map((s) => s.id));

  const shown = new Map<string, number>();
  const basis = new Set<string>();
  for (const claim of Object.values(data.claims)) {
    const parsed = claimSchema.safeParse(claim);
    if (!parsed.success)
      add(`Утверждение ${claim.id}: ${parsed.error.issues[0]?.message}`);
    const needsEvidence =
      claim.type === "book_fact" || claim.type === "external_research";
    if (needsEvidence && claim.evidence.length === 0)
      add(`${claim.id}: факт без источника`);
    if (!needsEvidence && claim.basedOn.length === 0)
      add(`${claim.id}: вывод без оснований`);
    for (const evidence of claim.evidence) {
      if (!sourceIds.has(evidence.sourceId))
        add(`${claim.id}: нет источника ${evidence.sourceId}`);
      if (evidence.excerptId && !excerpts.has(evidence.excerptId)) {
        add(`${claim.id}: нет выдержки ${evidence.excerptId}`);
      }
    }
    for (const id of claim.basedOn) {
      if (!data.claims[id]) add(`${claim.id}: основание ${id} не найдено`);
      if (id === claim.id) add(`${claim.id}: опирается сам на себя`);
      basis.add(id);
    }
  }

  const usedActions = new Set<string>();
  const show = (id: string, where: string) => {
    if (!data.claims[id]) add(`${where}: утверждение ${id} не найдено`);
    shown.set(id, (shown.get(id) ?? 0) + 1);
  };
  for (const slide of data.slides) {
    const parsed = slideSchema.safeParse(slide);
    if (!parsed.success)
      add(`Слайд «${slide.title}»: ${parsed.error.issues[0]?.message}`);
    for (const block of slide.blocks) {
      if (block.kind === "claim" || block.kind === "score")
        show(block.claimId, slide.title);
      if (block.kind === "item") {
        for (const entry of block.claims) show(entry.claimId, slide.title);
        if (block.actionId) usedActions.add(block.actionId);
      }
      if (block.kind === "action") usedActions.add(block.actionId);
      if (block.kind === "diagram") {
        for (const problem of checkDiagram(block.diagram))
          add(`«${slide.title}»: ${problem}`);
      }
    }
  }

  for (const [id, count] of shown) {
    if (count > 1)
      add(`${id} показано на слайдах ${count} раза — одна мысль не должна повторяться`);
  }
  for (const id of Object.keys(data.claims)) {
    if (!shown.has(id) && !basis.has(id)) add(`${id} нигде не используется`);
  }
  for (const action of Object.values(data.actions)) {
    const parsed = actionSchema.safeParse(action);
    if (!parsed.success) add(`Действие ${action.id}: ${parsed.error.issues[0]?.message}`);
    if (!data.claims[action.claimId])
      add(`Действие ${action.id}: нет утверждения ${action.claimId}`);
  }
  for (const id of usedActions) if (!data.actions[id]) add(`Действие ${id} не найдено`);
  for (const id of Object.keys(data.actions)) {
    if (!usedActions.has(id)) add(`Действие ${id} нигде не показано`);
  }

  const sections = new Set(data.slides.map((slide) => slide.section));
  for (const section of SECTIONS)
    if (!sections.has(section)) add(`Нет раздела ${section}`);
  return problems;
}

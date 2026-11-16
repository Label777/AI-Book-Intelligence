/** Проверка спецификации схемы: число элементов и длина подписей зависят от типа. */
import { LIMITS } from "../config";
import type { Diagram } from "../schema";

/** [минимум, максимум] элементов и число подписей осей для каждого типа схемы. */
const RULES: Record<
  Diagram["type"],
  { items: [number, number]; axes: [number, number] }
> = {
  cycle: { items: [3, 6], axes: [0, 0] },
  pyramid: { items: [3, 5], axes: [0, 0] },
  matrix: { items: [4, 4], axes: [2, 2] },
  flow: { items: [3, 6], axes: [0, 0] },
  comparison: { items: [2, 6], axes: [2, 3] },
  tree: { items: [2, 6], axes: [0, 0] },
};

export function checkDiagram(diagram: Diagram): string[] {
  const problems: string[] = [];
  const rule = RULES[diagram.type];
  const [minItems, maxItems] = rule.items;
  const [minAxes, maxAxes] = rule.axes;

  if (!diagram.title.trim()) problems.push("У схемы нет названия.");
  if (diagram.items.length < minItems || diagram.items.length > maxItems) {
    problems.push(
      `Схема типа ${diagram.type}: элементов должно быть от ${minItems} до ${maxItems}, сейчас ${diagram.items.length}.`,
    );
  }
  if (diagram.axes.length < minAxes || diagram.axes.length > maxAxes) {
    problems.push(
      `Схема типа ${diagram.type}: подписей осей должно быть от ${minAxes} до ${maxAxes}, сейчас ${diagram.axes.length}.`,
    );
  }
  for (const label of [...diagram.items.map((i) => i.label), ...diagram.axes]) {
    if (!label.trim()) problems.push("Пустая подпись в схеме.");
    else if (label.length > LIMITS.diagramLabelMaxChars) {
      problems.push(
        `Подпись «${label.slice(0, 30)}…» длиннее ${LIMITS.diagramLabelMaxChars} символов.`,
      );
    }
  }
  return problems;
}

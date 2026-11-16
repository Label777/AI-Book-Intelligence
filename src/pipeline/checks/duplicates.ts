/**
 * Поиск повторов: «не повторять одну мысль разными словами ради объёма».
 * Сравнение — по триграммам символов; оно ловит близкие формулировки.
 * Перефразирование другими словами оно не видит — для этого на шаге разбора
 * модель получает список уже сформулированных мыслей с требованием не повторять их.
 */
import { SIMILARITY } from "../config";
import { similarity } from "../text";

export interface TextItem {
  id: string;
  text: string;
}

export interface DuplicatePair {
  /** Утверждение, которое остаётся (встретилось раньше). */
  keep: string;
  /** Повтор. */
  drop: string;
  similarity: number;
}

/** Пары повторов среди утверждений; порядок списка задаёт, какое из двух считается исходным. */
export function findDuplicates(
  items: TextItem[],
  threshold: number = SIMILARITY.duplicate,
): DuplicatePair[] {
  const pairs: DuplicatePair[] = [];
  const dropped = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    if (dropped.has(items[i].id)) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (dropped.has(items[j].id)) continue;
      const score = similarity(items[i].text, items[j].text);
      if (score >= threshold) {
        pairs.push({ keep: items[i].id, drop: items[j].id, similarity: score });
        dropped.add(items[j].id);
      }
    }
  }
  return pairs;
}

/**
 * Четыре типа утверждений — основа продукта (docs/03-architecture.md, таблица claims).
 * Идентификаторы совпадают со значениями поля claims.type.
 */
export const PROVENANCE_TYPES = [
  "book_fact",
  "ai_interpretation",
  "external_research",
  "critique",
] as const;

export type ProvenanceType = (typeof PROVENANCE_TYPES)[number];

export type ProvenanceShape = "circle" | "diamond" | "triangle" | "square";

interface ProvenanceInfo {
  /** Короткая подпись на метке. */
  label: string;
  /** Полное название типа. */
  name: string;
  /** Что означает метка — для блока об источниках и подсказок. */
  description: string;
  /** Форма значка: метки различаются не только цветом. */
  shape: ProvenanceShape;
}

export const PROVENANCE: Record<ProvenanceType, ProvenanceInfo> = {
  book_fact: {
    label: "Книга",
    name: "Факт из книги",
    description: "Утверждение подтверждено текстом книги или надёжным источником о ней.",
    shape: "circle",
  },
  ai_interpretation: {
    label: "AI",
    name: "Интерпретация AI",
    description:
      "Вывод модели на основе фактов из книги. Видно, на какие факты он опирается.",
    shape: "diamond",
  },
  external_research: {
    label: "Исследование",
    name: "Внешнее исследование",
    description: "Данные за пределами книги — со ссылкой на публикацию.",
    shape: "triangle",
  },
  critique: {
    label: "Критика",
    name: "Критический вывод",
    description: "Оценка сильных и слабых сторон книги с аргументацией.",
    shape: "square",
  },
};

/** Состояние анализа: запрос и результаты уже выполненных шагов. */
import type { Book } from "../schema";
import type { AssembleOutput } from "./assemble";
import type { AnalysisOutput } from "./analysis";
import type { AnalysisRequest } from "./shared";
import type { SourcesOutput } from "./sources";
import type { StructureOutput } from "./structure";
import type { SummaryOutput } from "./summary";
import type { VerifyOutput } from "./verify";
import type { VisualsOutput } from "./visuals";

export interface AnalysisState {
  request: AnalysisRequest;
  book?: Book;
  sources?: SourcesOutput;
  structure?: StructureOutput;
  summary?: SummaryOutput;
  analysis?: AnalysisOutput;
  visuals?: VisualsOutput;
  assembled?: AssembleOutput;
  verified?: VerifyOutput;
}

/** Достаёт результат предыдущего шага; его отсутствие — ошибка порядка шагов, а не данных. */
export function need<K extends keyof AnalysisState>(
  state: AnalysisState,
  key: K,
): NonNullable<AnalysisState[K]> {
  const value = state[key];
  if (value === undefined || value === null) {
    throw new Error(`Шаг запущен раньше времени: нет результата «${String(key)}».`);
  }
  return value as NonNullable<AnalysisState[K]>;
}

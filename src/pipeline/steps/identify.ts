/**
 * Шаг 1. Идентификация книги.
 *
 * Поиск по каталогу и подтверждение издания пользователем выполняются до пайплайна
 * (этап 5). Здесь подтверждённая книга проверяется и приводится к единому виду,
 * а неподдерживаемый режим анализа отклоняется до того, как будет потрачен хоть один токен.
 */
import type { Step } from "../runner";
import { bookSchema, type Book } from "../schema";
import { requestSchema } from "./shared";
import type { AnalysisState } from "./state";

export const identifyStep: Step<AnalysisState, Book> = {
  name: "identify",
  version: "1",
  tiers: [],
  schema: bookSchema,
  input: (state) => state.request,
  async run(state) {
    const request = requestSchema.parse(state.request);
    if (request.mode === "full_text") {
      throw new Error(
        "Анализ по полному тексту появится вместе с загрузкой файлов. Сейчас доступен анализ по открытым источникам.",
      );
    }
    const clean = (value: string) => value.replace(/\s+/g, " ").trim();
    return {
      ...request.book,
      title: clean(request.book.title),
      authors: [...new Set(request.book.authors.map(clean))],
      description: request.book.description ? clean(request.book.description) : null,
      subjects: [...new Set(request.book.subjects.map(clean).filter(Boolean))],
    };
  },
  apply: (state, book) => ({ ...state, book }),
};

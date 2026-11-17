import type { AnalysisRequest } from "@/pipeline";
import type { Report } from "@/pipeline/steps/verify";
import type { Action, Book, Claim, Coverage, Slide, Source } from "@/pipeline/schema";
import type { StepName } from "@/pipeline/store";

/** Запись об анализе: что запрошено и чем закончилось. Результаты шагов лежат в хранилище пайплайна. */
export interface AnalysisMeta {
  id: string;
  request: AnalysisRequest;
  createdAt: string;
  /** running — идёт или был прерван перезапуском сервера; остальное — итог. */
  status: "running" | "completed" | "halted" | "failed";
  /** Почему остановлен или упал — формулировка для пользователя. */
  reason: string | null;
  finishedAt: string | null;
}

export type AnalysisPhase =
  /** Идёт прямо сейчас в этом процессе. */
  | "running"
  /** Был запущен, но процесс перезапустился: можно продолжить с места остановки. */
  | "interrupted"
  /** Готов и прошёл проверку. */
  | "ready"
  /** Остановлен без ошибки: источников недостаточно. */
  | "halted"
  /** Проверка не позволила опубликовать результат. */
  | "unpublishable"
  | "failed";

export interface StepProgress {
  step: StepName;
  status: "pending" | "running" | "done" | "failed";
}

export interface AnalysisStatus {
  meta: AnalysisMeta;
  phase: AnalysisPhase;
  steps: StepProgress[];
  /** Отчёт о покрытии источниками — появляется после второго шага. */
  coverage: Coverage | null;
  sourceCount: number;
  reasons: string[];
}

/** Всё, что нужно просмотрщику презентации. Передаётся в клиентский компонент целиком. */
export interface PresentationData {
  analysisId: string;
  book: Book;
  mode: AnalysisRequest["mode"];
  createdAt: string;
  slides: Slide[];
  claims: Record<string, Claim>;
  actions: Record<string, Action>;
  sources: Source[];
  coverage: Coverage;
  report: Report;
  /**
   * Анализ подготовлен вручную (Claude в чате) по открытым источникам, а не движком.
   * Выдержки в источниках у таких анализов — пересказ, а не дословный текст.
   */
  editorial?: {
    preparedAt: string;
    /** Как готовился анализ — показывается в «Как сделан этот анализ». */
    method: string;
  };
}

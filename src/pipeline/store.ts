/**
 * Хранилище результатов шагов. Интерфейс один, реализаций две:
 * в памяти (сейчас) и таблица pipeline_steps в Postgres (после подключения базы).
 */
import type { Usage } from "./model";

export const STEP_NAMES = [
  "identify",
  "sources",
  "structure",
  "summary",
  "analysis",
  "visuals",
  "assemble",
  "verify",
] as const;
export type StepName = (typeof STEP_NAMES)[number];

export interface StepRecord {
  analysisId: string;
  step: StepName;
  status: "done" | "failed";
  /** Хэш входа, версии шага и моделей: если он не изменился, шаг не выполняется заново. */
  inputHash: string;
  output: unknown;
  error: string | null;
  usage: Usage;
  startedAt: string;
  finishedAt: string;
}

export interface PipelineStore {
  getStep(analysisId: string, step: StepName): Promise<StepRecord | null>;
  saveStep(record: StepRecord): Promise<void>;
  listSteps(analysisId: string): Promise<StepRecord[]>;
}

export class InMemoryPipelineStore implements PipelineStore {
  private readonly records = new Map<string, StepRecord>();

  async getStep(analysisId: string, step: StepName) {
    return structuredClone(this.records.get(`${analysisId}:${step}`) ?? null);
  }

  async saveStep(record: StepRecord) {
    this.records.set(`${record.analysisId}:${record.step}`, structuredClone(record));
  }

  async listSteps(analysisId: string) {
    return STEP_NAMES.map((step) => this.records.get(`${analysisId}:${step}`))
      .filter((record): record is StepRecord => record !== undefined)
      .map((record) => structuredClone(record));
  }
}

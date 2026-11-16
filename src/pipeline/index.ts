/**
 * AI-движок анализа книги: восемь шагов от подтверждённой книги до проверенной презентации.
 * Описание — docs/08-ai-engine.md.
 */
import type { ModelClient } from "./model";
import {
  runPipeline,
  type PipelineEvent,
  type PipelineResult,
  type Step,
} from "./runner";
import { analysisStep } from "./steps/analysis";
import { assembleStep } from "./steps/assemble";
import { identifyStep } from "./steps/identify";
import { requestSchema, type AnalysisRequest } from "./steps/shared";
import { sourcesStep } from "./steps/sources";
import type { AnalysisState } from "./steps/state";
import { structureStep } from "./steps/structure";
import { summaryStep } from "./steps/summary";
import { verifyStep } from "./steps/verify";
import { visualsStep } from "./steps/visuals";
import type { PipelineStore } from "./store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- шаги возвращают разные типы
export const ANALYSIS_STEPS: Step<AnalysisState, any>[] = [
  identifyStep,
  sourcesStep,
  structureStep,
  summaryStep,
  analysisStep,
  visualsStep,
  assembleStep,
  verifyStep,
];

/** Версия пайплайна целиком — часть ключа общего кэша анализов. */
export const PIPELINE_VERSION = ANALYSIS_STEPS.map(
  (step) => `${step.name}${step.version}`,
).join(".");

export interface AnalyzeOptions {
  analysisId: string;
  request: AnalysisRequest;
  store: PipelineStore;
  model: ModelClient;
  now?: () => Date;
  onEvent?: (event: PipelineEvent) => void;
}

/**
 * Запускает или продолжает анализ. Повторный вызов с тем же `analysisId`
 * берёт готовые шаги из хранилища и выполняет только оставшиеся.
 */
export function analyzeBook(
  options: AnalyzeOptions,
): Promise<PipelineResult<AnalysisState>> {
  const request = requestSchema.parse(options.request);
  return runPipeline<AnalysisState>({
    analysisId: options.analysisId,
    steps: ANALYSIS_STEPS,
    initialState: { request },
    store: options.store,
    model: options.model,
    now: options.now,
    onEvent: options.onEvent,
  });
}

export type {
  AnalysisRequest,
  AnalysisState,
  ModelClient,
  PipelineEvent,
  PipelineResult,
  PipelineStore,
};
export { InMemoryPipelineStore, STEP_NAMES, type StepName } from "./store";
export type { Report, VerifyOutput } from "./steps/verify";

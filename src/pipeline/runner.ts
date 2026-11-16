/**
 * Каркас пайплайна: шаги выполняются по очереди, результат каждого сохраняется.
 *
 * - Повтор с места сбоя: при повторном запуске готовые шаги берутся из хранилища.
 * - Пересчёт только изменившегося: ключ шага — хэш его входа, версии и моделей;
 *   изменился промпт (версия) или вход — шаг и все следующие выполняются заново.
 * - Учёт расхода: для каждого шага записываются число вызовов, токены и поиски.
 */
import type { z } from "zod";

import type { ModelTier } from "./config";
import { hashOf } from "./hash";
import { addUsage, meter, ZERO_USAGE, type ModelClient, type Usage } from "./model";
import type { PipelineStore, StepName, StepRecord } from "./store";

export interface StepContext {
  model: ModelClient;
  now: () => Date;
}

export interface Step<State, Output = unknown> {
  name: StepName;
  /** Меняется при правке промпта или логики шага — и сбрасывает его кэш. */
  version: string;
  /** Уровни моделей, которыми пользуется шаг: смена модели тоже сбрасывает кэш. */
  tiers: ModelTier[];
  schema: z.ZodType<Output>;
  /** Данные, от которых зависит результат шага. */
  input(state: State): unknown;
  run(state: State, ctx: StepContext): Promise<Output>;
  /** Возвращает состояние с добавленным результатом шага. */
  apply(state: State, output: Output): State;
  /** Причина остановить пайплайн без ошибки — например, источников недостаточно. */
  halt?(output: Output): string | null;
}

export type PipelineEvent =
  | { type: "step_started"; step: StepName }
  | { type: "step_cached"; step: StepName }
  | { type: "step_done"; step: StepName; usage: Usage }
  | { type: "step_failed"; step: StepName; error: string }
  | { type: "halted"; step: StepName; reason: string };

export interface PipelineResult<State> {
  status: "completed" | "halted" | "failed";
  state: State;
  /** Шаг, на котором пайплайн остановился или упал. */
  stoppedAt: StepName | null;
  reason: string | null;
  /** Расход модели в этом запуске; шаги, взятые из кэша, в него не входят. */
  usage: Usage;
}

export interface RunOptions<State> {
  analysisId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- шаги возвращают разные типы
  steps: Step<State, any>[];
  initialState: State;
  store: PipelineStore;
  model: ModelClient;
  now?: () => Date;
  onEvent?: (event: PipelineEvent) => void;
}

export async function runPipeline<State>(
  options: RunOptions<State>,
): Promise<PipelineResult<State>> {
  const { analysisId, steps, store, model } = options;
  const now = options.now ?? (() => new Date());
  const emit = options.onEvent ?? (() => {});
  let state = options.initialState;
  let usage = ZERO_USAGE;

  for (const step of steps) {
    const inputHash = hashOf({
      version: step.version,
      models: step.tiers.map((tier) => model.modelFor(tier)),
      input: step.input(state),
    });

    let output: unknown;
    const cached = await store.getStep(analysisId, step.name);
    const reusable =
      cached?.status === "done" && cached.inputHash === inputHash
        ? step.schema.safeParse(cached.output)
        : null;

    if (reusable?.success) {
      output = reusable.data;
      emit({ type: "step_cached", step: step.name });
    } else {
      emit({ type: "step_started", step: step.name });
      const startedAt = now().toISOString();
      const metered = meter(model);
      const base: Omit<
        StepRecord,
        "status" | "output" | "error" | "usage" | "finishedAt"
      > = {
        analysisId,
        step: step.name,
        inputHash,
        startedAt,
      };
      try {
        const raw = await step.run(state, { model: metered.client, now });
        output = step.schema.parse(raw);
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : String(cause);
        usage = addUsage(usage, metered.usage());
        await store.saveStep({
          ...base,
          status: "failed",
          output: null,
          error,
          usage: metered.usage(),
          finishedAt: now().toISOString(),
        });
        emit({ type: "step_failed", step: step.name, error });
        return { status: "failed", state, stoppedAt: step.name, reason: error, usage };
      }
      usage = addUsage(usage, metered.usage());
      await store.saveStep({
        ...base,
        status: "done",
        output,
        error: null,
        usage: metered.usage(),
        finishedAt: now().toISOString(),
      });
      emit({ type: "step_done", step: step.name, usage: metered.usage() });
    }

    state = step.apply(state, output);
    const reason = step.halt?.(output) ?? null;
    if (reason) {
      emit({ type: "halted", step: step.name, reason });
      return { status: "halted", state, stoppedAt: step.name, reason, usage };
    }
  }

  return { status: "completed", state, stoppedAt: null, reason: null, usage };
}

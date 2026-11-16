import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { ModelTier } from "@/pipeline/config";
import { hashOf, stableStringify } from "@/pipeline/hash";
import { costOf, type ModelClient, type Usage } from "@/pipeline/model";
import { runPipeline, type Step } from "@/pipeline/runner";
import { InMemoryPipelineStore } from "@/pipeline/store";

interface State {
  seed: number;
  a?: number;
  b?: number;
}

const usage: Usage = {
  calls: 1,
  inputTokens: 10,
  outputTokens: 5,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
};

function fakeModel(models: Partial<Record<ModelTier, string>> = {}): ModelClient {
  return {
    modelFor: (tier) => models[tier] ?? `${tier}-1`,
    generateObject: async (request) => ({ object: request.schema.parse(1), usage }),
    research: async () => ({ text: "", citations: [], usage }),
  };
}

function steps(log: string[], versions = { a: "1", b: "1" }): Step<State, number>[] {
  return [
    {
      name: "identify",
      version: versions.a,
      tiers: [],
      schema: z.number(),
      input: (state) => state.seed,
      run: async (state) => {
        log.push("a");
        return state.seed + 1;
      },
      apply: (state, a) => ({ ...state, a }),
    },
    {
      name: "sources",
      version: versions.b,
      tiers: ["main"],
      schema: z.number(),
      input: (state) => state.a,
      run: async (state, ctx) => {
        log.push("b");
        await ctx.model.generateObject({
          task: "t",
          tier: "main",
          system: "",
          prompt: "",
          schema: z.number(),
        });
        return state.a! * 10;
      },
      apply: (state, b) => ({ ...state, b }),
    },
  ];
}

const options = (
  log: string[],
  store = new InMemoryPipelineStore(),
  seed = 1,
  versions?: { a: string; b: string },
  model = fakeModel(),
) => ({
  analysisId: "x",
  steps: steps(log, versions),
  initialState: { seed } as State,
  store,
  model,
});

describe("каркас пайплайна", () => {
  it("выполняет шаги по порядку и передаёт результат дальше", async () => {
    const log: string[] = [];
    const result = await runPipeline(options(log));
    expect(result).toMatchObject({
      status: "completed",
      state: { seed: 1, a: 2, b: 20 },
    });
    expect(log).toEqual(["a", "b"]);
    expect(result.usage).toMatchObject({ calls: 1, inputTokens: 10 });
  });

  it("при том же входе берёт результат из хранилища", async () => {
    const log: string[] = [];
    const store = new InMemoryPipelineStore();
    await runPipeline(options(log, store));
    const again = await runPipeline(options(log, store));
    expect(log).toEqual(["a", "b"]);
    expect(again.state.b).toBe(20);
    expect(again.usage.calls).toBe(0);
  });

  it("изменение версии шага пересчитывает его; следующий шаг — только если изменился его вход", async () => {
    const log: string[] = [];
    const store = new InMemoryPipelineStore();
    await runPipeline(options(log, store));
    await runPipeline(options(log, store, 1, { a: "2", b: "1" }));
    expect(log).toEqual(["a", "b", "a"]);
    await runPipeline(options(log, store, 1, { a: "2", b: "2" }));
    expect(log).toEqual(["a", "b", "a", "b"]);
  });

  it("изменение входа пересчитывает шаг и всё, что от него зависит", async () => {
    const log: string[] = [];
    const store = new InMemoryPipelineStore();
    await runPipeline(options(log, store, 1));
    const result = await runPipeline(options(log, store, 5));
    expect(log).toEqual(["a", "b", "a", "b"]);
    expect(result.state.b).toBe(60);
  });

  it("смена модели сбрасывает кэш только тех шагов, которые ею пользуются", async () => {
    const log: string[] = [];
    const store = new InMemoryPipelineStore();
    await runPipeline(options(log, store));
    await runPipeline(options(log, store, 1, undefined, fakeModel({ main: "main-2" })));
    expect(log).toEqual(["a", "b", "b"]);
  });

  it("сохраняет сбой, останавливается и при повторе выполняет только упавший шаг", async () => {
    const log: string[] = [];
    const store = new InMemoryPipelineStore();
    const failing = options(log, store);
    const original = failing.steps[1].run;
    failing.steps[1].run = async () => {
      log.push("b!");
      throw new Error("сбой");
    };
    const failed = await runPipeline(failing);
    expect(failed).toMatchObject({
      status: "failed",
      stoppedAt: "sources",
      reason: "сбой",
    });
    expect(await store.getStep("x", "sources")).toMatchObject({
      status: "failed",
      error: "сбой",
      output: null,
    });

    failing.steps[1].run = original;
    const ok = await runPipeline(failing);
    expect(ok.status).toBe("completed");
    expect(log).toEqual(["a", "b!", "b"]);
  });

  it("результат, не прошедший схему, считается сбоем шага", async () => {
    const log: string[] = [];
    const bad = options(log);
    bad.steps[0].run = async () => "не число" as unknown as number;
    const result = await runPipeline(bad);
    expect(result).toMatchObject({ status: "failed", stoppedAt: "identify" });
  });

  it("останавливается без ошибки, если шаг сообщает причину", async () => {
    const log: string[] = [];
    const halting = options(log);
    halting.steps[0].halt = (a) => (a > 1 ? "дальше нельзя" : null);
    const result = await runPipeline(halting);
    expect(result).toMatchObject({
      status: "halted",
      stoppedAt: "identify",
      reason: "дальше нельзя",
    });
    expect(log).toEqual(["a"]);
    // Остановка сохраняется: повторный запуск не выполняет шаг заново и останавливается там же.
    const again = await runPipeline(halting);
    expect(again.status).toBe("halted");
    expect(log).toEqual(["a"]);
  });
});

describe("хэш и стоимость", () => {
  it("хэш не зависит от порядка ключей и пропускает undefined", () => {
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: undefined }] })).toBe(
      '{"a":[2,{"d":1}],"b":1}',
    );
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ b: 2, a: 1 }));
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
  });
  it("стоимость считается по заданному тарифу", () => {
    const spent: Usage = {
      calls: 3,
      inputTokens: 2_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 1_000_000,
      cacheWriteTokens: 0,
      webSearches: 20,
    };
    const pricing = {
      inputPerMTok: 3,
      outputPerMTok: 15,
      cacheReadPerMTok: 0.3,
      cacheWritePerMTok: 3.75,
      webSearchPerK: 10,
    };
    expect(costOf(spent, pricing)).toBeCloseTo(6 + 7.5 + 0.3 + 0.2);
  });
});

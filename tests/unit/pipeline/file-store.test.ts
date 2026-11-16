import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { analyzeBook } from "@/pipeline";
import { FilePipelineStore } from "@/pipeline/file-store";
import { ZERO_USAGE } from "@/pipeline/model";
import type { StepRecord } from "@/pipeline/store";

import { REQUEST, ScriptedModel } from "./fixture";

let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "pipeline-store-"));
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

const record = (step: StepRecord["step"], output: unknown): StepRecord => ({
  analysisId: "книга/1",
  step,
  status: "done",
  inputHash: "h",
  output,
  error: null,
  usage: ZERO_USAGE,
  startedAt: "2026-11-16T10:00:00Z",
  finishedAt: "2026-11-16T10:00:01Z",
});

describe("файловое хранилище шагов", () => {
  it("сохраняет и читает шаги, возвращает их в порядке пайплайна", async () => {
    const store = new FilePipelineStore(directory);
    expect(await store.getStep("книга/1", "sources")).toBeNull();
    await store.saveStep(record("summary", { n: 2 }));
    await store.saveStep(record("identify", { n: 1 }));
    await store.saveStep(record("summary", { n: 3 }));
    expect((await store.getStep("книга/1", "summary"))?.output).toEqual({ n: 3 });
    expect((await store.listSteps("книга/1")).map((r) => r.step)).toEqual([
      "identify",
      "summary",
    ]);
    expect(await store.listSteps("другая")).toEqual([]);
  });

  it("прогон продолжается из файлов в новом процессе", async () => {
    const model = new ScriptedModel();
    const options = { analysisId: "resume", request: REQUEST, model };
    const first = await analyzeBook({
      ...options,
      store: new FilePipelineStore(directory),
    });
    expect(first.status).toBe("completed");
    const calls = model.calls.length;
    const second = await analyzeBook({
      ...options,
      store: new FilePipelineStore(directory),
    });
    expect(second.status).toBe("completed");
    expect(model.calls.length).toBe(calls);
    expect(second.state.verified).toEqual(first.state.verified);
  });
});

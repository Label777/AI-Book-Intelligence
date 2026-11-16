import { describe, expect, it } from "vitest";
import {
  AnalysisBusyError,
  AnalysisService,
  analysisIdFor,
  isAnalysisId,
  MAX_RUNNING,
  MemoryMetaStore,
} from "@/analysis/service";
import { InMemoryPipelineStore, type ModelClient } from "@/pipeline";
import { defaultHandlers, REQUEST, ScriptedModel } from "./pipeline/fixture";

const NOW = () => new Date("2026-11-16T12:00:00.000Z");

function setup(createModel: (() => ModelClient) | null = () => new ScriptedModel()) {
  const store = new InMemoryPipelineStore();
  const metaStore = new MemoryMetaStore();
  const service = new AnalysisService({ store, metaStore, createModel, now: NOW });
  return { service, store, metaStore };
}

const requestFor = (workId: string) => ({
  ...REQUEST,
  book: { ...REQUEST.book, workId },
});

describe("идентификатор анализа", () => {
  it("один и тот же для одной книги и разный для разных", () => {
    expect(analysisIdFor(REQUEST)).toBe(analysisIdFor(structuredClone(REQUEST)));
    expect(analysisIdFor(REQUEST)).not.toBe(analysisIdFor(requestFor("OL1W")));
    expect(analysisIdFor(REQUEST)).not.toBe(
      analysisIdFor({ ...REQUEST, language: "en" }),
    );
    expect(isAnalysisId(analysisIdFor(REQUEST))).toBe(true);
  });

  it("не принимает чужие строки", () => {
    expect(isAnalysisId("../../etc/passwd")).toBe(false);
    expect(isAnalysisId("")).toBe(false);
    expect(isAnalysisId("a".repeat(65))).toBe(false);
  });
});

describe("сервис анализа", () => {
  it("проходит путь от запуска до готовой презентации", async () => {
    const { service } = setup();
    const id = await service.start(REQUEST);

    const during = await service.status(id);
    expect(during?.phase).toBe("running");
    expect(await service.presentation(id)).toBeNull();

    await service.settled(id);
    const status = await service.status(id);
    expect(status?.phase).toBe("ready");
    expect(status?.steps.every((step) => step.status === "done")).toBe(true);
    expect(status?.coverage?.level).toBeDefined();
    expect(status?.sourceCount).toBeGreaterThan(0);

    const data = await service.presentation(id);
    expect(data?.book.title).toBe("Тихие системы");
    expect(data?.mode).toBe("sources_only");
    expect(data?.slides.length).toBeGreaterThanOrEqual(8);
    // Каждая ссылка слайда на утверждение и действие разрешается.
    for (const slide of data!.slides) {
      for (const block of slide.blocks) {
        if (block.kind === "claim" || block.kind === "score") {
          expect(data!.claims[block.claimId]).toBeDefined();
        }
        if (block.kind === "action") expect(data!.actions[block.actionId]).toBeDefined();
        if (block.kind === "item") {
          for (const claim of block.claims)
            expect(data!.claims[claim.claimId]).toBeDefined();
          if (block.actionId) expect(data!.actions[block.actionId]).toBeDefined();
        }
      }
    }
    // У каждого факта есть источник с выдержкой.
    for (const claim of Object.values(data!.claims)) {
      if (claim.type !== "book_fact") continue;
      expect(claim.evidence.length).toBeGreaterThan(0);
      for (const evidence of claim.evidence) {
        expect(data!.sources.some((source) => source.id === evidence.sourceId)).toBe(
          true,
        );
      }
    }
  });

  it("повторный запуск готового анализа не обращается к модели", async () => {
    let created = 0;
    const { service } = setup(() => {
      created += 1;
      return new ScriptedModel();
    });
    const id = await service.start(REQUEST);
    await service.settled(id);
    expect(await service.start(REQUEST)).toBe(id);
    expect(created).toBe(1);
  });

  it("одновременные запросы на одну книгу запускают один анализ", async () => {
    let created = 0;
    const { service } = setup(() => {
      created += 1;
      return new ScriptedModel();
    });
    const [a, b] = await Promise.all([service.start(REQUEST), service.start(REQUEST)]);
    expect(a).toBe(b);
    await service.settled(a);
    expect(created).toBe(1);
  });

  it("без ключа модели запуск невозможен, а статус неизвестного анализа — null", async () => {
    const { service } = setup(null);
    expect(service.available).toBe(false);
    await expect(service.start(REQUEST)).rejects.toThrow(/ключ/);
    expect(await service.status(analysisIdFor(REQUEST))).toBeNull();
    expect(await service.status("нет такого")).toBeNull();
  });

  it("ограничивает число одновременных анализов", async () => {
    const { service } = setup();
    const ids = [];
    for (let index = 0; index < MAX_RUNNING; index += 1) {
      ids.push(await service.start(requestFor(`OL${index + 1}W`)));
    }
    await expect(service.start(requestFor("OL99W"))).rejects.toBeInstanceOf(
      AnalysisBusyError,
    );
    await Promise.all(ids.map((id) => service.settled(id)));
    // Место освободилось.
    const id = await service.start(requestFor("OL99W"));
    await service.settled(id);
    expect((await service.status(id))?.phase).toBe("ready");
  });

  it("мало источников: анализ остановлен с понятной причиной и заново не запускается", async () => {
    let created = 0;
    const { service } = setup(() => {
      created += 1;
      return new ScriptedModel(undefined, []);
    });
    const id = await service.start(REQUEST);
    await service.settled(id);

    const status = await service.status(id);
    expect(status?.phase).toBe("halted");
    expect(status?.reasons.join(" ")).toMatch(/источник/i);
    expect(await service.presentation(id)).toBeNull();

    await service.start(REQUEST);
    expect(created).toBe(1);
  });

  it("сбой модели: анализ помечен как упавший, продолжение не повторяет готовые шаги", async () => {
    // У первой модели нет ответа для шага «summary»: шаги до него успевают выполниться.
    const handlers = defaultHandlers();
    delete handlers.summary;
    const failing = new ScriptedModel(handlers);
    const working = new ScriptedModel();
    const models = [failing, working];
    const { service } = setup(() => models.shift()!);

    const id = await service.start(REQUEST);
    await service.settled(id);
    const failed = await service.status(id);
    expect(failed?.phase).toBe("failed");
    expect(failed?.steps.find((step) => step.step === "identify")?.status).toBe("done");
    expect(failed?.steps.some((step) => step.status === "failed")).toBe(true);

    await service.start(REQUEST);
    await service.settled(id);
    expect((await service.status(id))?.phase).toBe("ready");
    // Источники уже найдены первой моделью — вторая их заново не ищет.
    expect(failing.count("sources.research")).toBe(1);
    expect(working.count("sources.research")).toBe(0);
    expect(working.count("summary")).toBe(1);
  });

  it("запись «идёт» без работающей задачи — это прерванный анализ", async () => {
    const { service, metaStore } = setup();
    const id = analysisIdFor(REQUEST);
    await metaStore.save({
      id,
      request: REQUEST,
      createdAt: NOW().toISOString(),
      status: "running",
      reason: null,
      finishedAt: null,
    });
    expect((await service.status(id))?.phase).toBe("interrupted");
    // Продолжение доводит его до конца.
    await service.start(REQUEST);
    await service.settled(id);
    expect((await service.status(id))?.phase).toBe("ready");
  });
});

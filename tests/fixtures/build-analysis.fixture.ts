/**
 * Собирает готовый анализ для сценарных тестов: прогоняет настоящий пайплайн
 * на подставной модели и сохраняет результаты шагов в tests/fixtures/analysis.
 * Книга в нём выдуманная («Тихие системы») — это тестовые данные, пользователям они не показываются.
 *
 * Запуск: npm run fixtures:analysis (после изменений в пайплайне).
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { AnalysisService } from "@/analysis/service";
import type { AnalysisMeta } from "@/analysis/types";
import { FilePipelineStore } from "@/pipeline/file-store";
import { REQUEST, ScriptedModel } from "../unit/pipeline/fixture";

const ROOT = path.resolve(process.cwd(), "tests/fixtures/analysis");
const NOW = () => new Date("2026-11-16T12:00:00.000Z");

class DirMetaStore {
  constructor(private readonly renameTo: (id: string) => string) {}
  private readonly memory = new Map<string, AnalysisMeta>();
  async get(id: string) {
    return this.memory.get(id) ?? null;
  }
  async save(meta: AnalysisMeta) {
    this.memory.set(meta.id, meta);
    const dir = path.join(ROOT, this.renameTo(meta.id));
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  }
}

it("собирает данные для сценарных тестов", async () => {
  await rm(ROOT, { recursive: true, force: true });

  // 1. Готовый анализ.
  const service = new AnalysisService({
    store: new FilePipelineStore(ROOT),
    metaStore: new DirMetaStore((id) => id),
    createModel: () => new ScriptedModel(),
    now: NOW,
  });
  const id = await service.start(REQUEST);
  await service.settled(id);
  const status = await service.status(id);
  expect(status?.phase).toBe("ready");
  await cp(path.join(ROOT, id), path.join(ROOT, "demo"), { recursive: true });
  await rm(path.join(ROOT, id), { recursive: true });
  const meta = { ...status!.meta, id: "demo" };
  await writeFile(
    path.join(ROOT, "demo/meta.json"),
    `${JSON.stringify(meta, null, 2)}\n`,
  );

  // 1а. Тот же анализ с очень длинными текстами — проверить, что вёрстка их выдерживает.
  const long = path.join(ROOT, "demo-long");
  await cp(path.join(ROOT, "demo"), long, { recursive: true });
  const verifyFile = path.join(long, "8-verify.json");
  const record = JSON.parse(await readFile(verifyFile, "utf8"));
  const word = "Сверхдлинноесловобезединогопробела".repeat(5);
  for (const claim of record.output.claims) {
    claim.text = `${claim.text} ${word} ${claim.text} ${claim.text}`;
  }
  for (const slide of record.output.slides) {
    slide.title = `${slide.title} — ${word.slice(0, 60)} и ещё очень длинное продолжение заголовка слайда`;
  }
  await writeFile(verifyFile, `${JSON.stringify(record, null, 2)}\n`);
  await writeFile(
    path.join(long, "meta.json"),
    `${JSON.stringify({ ...meta, id: "demo-long" }, null, 2)}\n`,
  );

  // 2. Прерванный анализ: запись «идёт», готовы только первые два шага.
  const interrupted = path.join(ROOT, "demo-interrupted");
  await mkdir(interrupted, { recursive: true });
  for (const file of ["1-identify.json", "2-sources.json"]) {
    await cp(path.join(ROOT, "demo", file), path.join(interrupted, file));
  }
  await writeFile(
    path.join(interrupted, "meta.json"),
    `${JSON.stringify({ ...meta, id: "demo-interrupted", status: "running", finishedAt: null }, null, 2)}\n`,
  );

  // 3. Остановленный анализ: источников не нашлось.
  const halted = path.join(ROOT, "demo-halted");
  await mkdir(halted, { recursive: true });
  await cp(path.join(ROOT, "demo/1-identify.json"), path.join(halted, "1-identify.json"));
  await writeFile(
    path.join(halted, "meta.json"),
    `${JSON.stringify(
      {
        ...meta,
        id: "demo-halted",
        status: "halted",
        reason:
          "Открытых источников о книге недостаточно для достоверного анализа. Не хватает: независимых источников о содержании книги.",
      },
      null,
      2,
    )}\n`,
  );
});

/**
 * Хранилище шагов в файлах: один JSON на шаг. Нужно для контрольных прогонов
 * (evals/) — прерванный прогон продолжается с места остановки, а результаты
 * каждого шага можно открыть и прочитать. В приложении его заменит таблица в Postgres.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { STEP_NAMES, type PipelineStore, type StepName, type StepRecord } from "./store";

export class FilePipelineStore implements PipelineStore {
  constructor(private readonly directory: string) {}

  private file(analysisId: string, step: StepName): string {
    const safe = analysisId.replace(/[^\w.-]+/g, "_");
    return path.join(
      this.directory,
      safe,
      `${STEP_NAMES.indexOf(step) + 1}-${step}.json`,
    );
  }

  async getStep(analysisId: string, step: StepName): Promise<StepRecord | null> {
    try {
      return JSON.parse(
        await readFile(this.file(analysisId, step), "utf8"),
      ) as StepRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async saveStep(record: StepRecord): Promise<void> {
    const file = this.file(record.analysisId, record.step);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  }

  async listSteps(analysisId: string): Promise<StepRecord[]> {
    const records = await Promise.all(
      STEP_NAMES.map((step) => this.getStep(analysisId, step)),
    );
    return records.filter((record): record is StepRecord => record !== null);
  }
}

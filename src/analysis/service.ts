import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  analyzeBook,
  InMemoryPipelineStore,
  PIPELINE_VERSION,
  STEP_NAMES,
  type AnalysisRequest,
  type ModelClient,
  type PipelineStore,
  type StepName,
} from "@/pipeline";
import { AnthropicModelClient } from "@/pipeline/anthropic";
import { FilePipelineStore } from "@/pipeline/file-store";
import type { SourcesOutput } from "@/pipeline/steps/sources";
import type { VerifyOutput } from "@/pipeline/steps/verify";
import type { Book } from "@/pipeline/schema";
import type {
  AnalysisMeta,
  AnalysisPhase,
  AnalysisStatus,
  PresentationData,
  StepProgress,
} from "./types";

/** Одновременно идущих анализов на процесс: каждый — десятки платных вызовов модели. */
export const MAX_RUNNING = 2;

/** Сервис занят: слишком много анализов идёт одновременно. */
export class AnalysisBusyError extends Error {
  constructor() {
    super("Сейчас создаётся слишком много анализов. Попробуйте через несколько минут.");
    this.name = "AnalysisBusyError";
  }
}

/** Хранилище записей об анализах — рядом с хранилищем шагов. */
interface MetaStore {
  get(id: string): Promise<AnalysisMeta | null>;
  save(meta: AnalysisMeta): Promise<void>;
}

class MemoryMetaStore implements MetaStore {
  private readonly records = new Map<string, AnalysisMeta>();
  async get(id: string) {
    return structuredClone(this.records.get(id) ?? null);
  }
  async save(meta: AnalysisMeta) {
    this.records.set(meta.id, structuredClone(meta));
  }
}

class FileMetaStore implements MetaStore {
  constructor(private readonly directory: string) {}
  private file(id: string) {
    return path.join(this.directory, id.replace(/[^\w.-]+/g, "_"), "meta.json");
  }
  async get(id: string) {
    try {
      return JSON.parse(await readFile(this.file(id), "utf8")) as AnalysisMeta;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
  async save(meta: AnalysisMeta) {
    const file = this.file(meta.id);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  }
}

interface Job {
  current: StepName | null;
  promise: Promise<void>;
}

export interface AnalysisServiceOptions {
  store: PipelineStore;
  metaStore: MetaStore;
  /** Создаёт клиент модели; null — модель не настроена, запуск невозможен. */
  createModel: (() => ModelClient) | null;
  now?: () => Date;
}

/** Идентификатор в адресе: только буквы, цифры, дефис. */
export function isAnalysisId(value: string): boolean {
  return /^[A-Za-z0-9-]{1,64}$/.test(value);
}

/**
 * Один анализ на книгу, режим, язык и версию пайплайна: повторный запрос
 * открывает готовый результат и не тратит токены.
 */
export function analysisIdFor(request: AnalysisRequest): string {
  const hash = createHash("sha256")
    .update(
      [request.book.workId, request.mode, request.language, PIPELINE_VERSION].join("|"),
    )
    .digest("hex")
    .slice(0, 10);
  return `${request.book.workId}-${request.language}-${hash}`;
}

export class AnalysisService {
  private readonly jobs = new Map<string, Job>();
  private readonly starting = new Map<string, Promise<string>>();
  private readonly now: () => Date;

  constructor(private readonly options: AnalysisServiceOptions) {
    this.now = options.now ?? (() => new Date());
  }

  /** Можно ли запускать анализ: настроен ли доступ к модели. */
  get available(): boolean {
    return this.options.createModel !== null;
  }

  /** Запускает анализ или продолжает прерванный. Возвращает идентификатор. */
  start(request: AnalysisRequest): Promise<string> {
    const id = analysisIdFor(request);
    // Два одновременных запроса на одну книгу не должны запустить два анализа.
    const pending = this.starting.get(id);
    if (pending) return pending;
    const promise = this.startOnce(id, request).finally(() => this.starting.delete(id));
    this.starting.set(id, promise);
    return promise;
  }

  private async startOnce(id: string, request: AnalysisRequest): Promise<string> {
    if (this.jobs.has(id)) return id;

    const existing = await this.options.metaStore.get(id);
    // Готовый или остановленный за нехваткой источников анализ заново не запускаем.
    if (existing && (existing.status === "completed" || existing.status === "halted"))
      return id;

    if (!this.options.createModel) {
      throw new Error("Запуск анализа недоступен: не задан ключ Claude API.");
    }
    if (this.jobs.size >= MAX_RUNNING) throw new AnalysisBusyError();
    // Место занимаем сразу, до первой асинхронной операции, чтобы лимит нельзя было обойти гонкой.
    const job: Job = { current: null, promise: Promise.resolve() };
    this.jobs.set(id, job);

    const meta: AnalysisMeta = {
      id,
      request,
      createdAt: existing?.createdAt ?? this.now().toISOString(),
      status: "running",
      reason: null,
      finishedAt: null,
    };
    try {
      await this.options.metaStore.save(meta);
    } catch (error) {
      this.jobs.delete(id);
      throw error;
    }
    job.promise = this.run(meta, job, this.options.createModel()).finally(() => {
      this.jobs.delete(id);
    });
    return id;
  }

  private async run(meta: AnalysisMeta, job: Job, model: ModelClient): Promise<void> {
    let status: AnalysisMeta["status"] = "failed";
    let reason: string | null = null;
    try {
      const result = await analyzeBook({
        analysisId: meta.id,
        request: meta.request,
        store: this.options.store,
        model,
        now: this.now,
        onEvent: (event) => {
          if (event.type === "step_started") job.current = event.step;
        },
      });
      status = result.status;
      reason = result.reason;
    } catch (error) {
      reason = error instanceof Error ? error.message : String(error);
    }
    await this.options.metaStore.save({
      ...meta,
      status,
      reason,
      finishedAt: this.now().toISOString(),
    });
  }

  /** Дожидается завершения идущего анализа — для тестов. */
  async settled(id: string): Promise<void> {
    await this.jobs.get(id)?.promise;
  }

  async status(id: string): Promise<AnalysisStatus | null> {
    if (!isAnalysisId(id)) return null;
    const meta = await this.options.metaStore.get(id);
    if (!meta) return null;

    const records = await this.options.store.listSteps(id);
    const job = this.jobs.get(id);
    const steps: StepProgress[] = STEP_NAMES.map((step) => {
      const record = records.find((item) => item.step === step);
      if (job?.current === step) return { step, status: "running" };
      if (record?.status === "done") return { step, status: "done" };
      if (record?.status === "failed" && !job) return { step, status: "failed" };
      return { step, status: "pending" };
    });

    const sources = records.find(
      (item) => item.step === "sources" && item.status === "done",
    )?.output as SourcesOutput | undefined;
    const verified = records.find(
      (item) => item.step === "verify" && item.status === "done",
    )?.output as VerifyOutput | undefined;

    let phase: AnalysisPhase;
    let reasons: string[] = meta.reason ? [meta.reason] : [];
    if (job) phase = "running";
    else if (meta.status === "running") phase = "interrupted";
    else if (meta.status === "halted") phase = "halted";
    else if (meta.status === "failed") phase = "failed";
    else if (!verified) phase = "failed";
    else if (!verified.report.publishable) {
      phase = "unpublishable";
      reasons = verified.report.reasons;
    } else phase = "ready";

    return {
      meta,
      phase,
      steps,
      coverage: sources?.coverage ?? null,
      sourceCount: sources?.sources.length ?? 0,
      reasons,
    };
  }

  /** Данные готовой презентации; null — если анализ не готов или не прошёл проверку. */
  async presentation(id: string): Promise<PresentationData | null> {
    const status = await this.status(id);
    if (status?.phase !== "ready") return null;

    const [identify, sources, verify] = await Promise.all(
      (["identify", "sources", "verify"] as const).map((step) =>
        this.options.store.getStep(id, step),
      ),
    );
    if (!identify || !sources || !verify) return null;
    const book = identify.output as Book;
    const { sources: sourceList, coverage } = sources.output as SourcesOutput;
    const verified = verify.output as VerifyOutput;

    return {
      analysisId: id,
      book,
      mode: status.meta.request.mode,
      createdAt: status.meta.createdAt,
      slides: verified.slides,
      claims: Object.fromEntries(verified.claims.map((claim) => [claim.id, claim])),
      actions: Object.fromEntries(
        verified.content.actions.map((action) => [action.id, action]),
      ),
      sources: sourceList,
      coverage,
      report: verified.report,
    };
  }
}

// Один сервис на процесс. Если задан каталог ANALYSIS_STORE_DIR, результаты переживают перезапуск.
const globalStore = globalThis as typeof globalThis & {
  __abiAnalysisService?: AnalysisService;
};

export function getAnalysisService(): AnalysisService {
  if (!globalStore.__abiAnalysisService) {
    const directory = process.env.ANALYSIS_STORE_DIR?.trim();
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    globalStore.__abiAnalysisService = new AnalysisService({
      store: directory ? new FilePipelineStore(directory) : new InMemoryPipelineStore(),
      metaStore: directory ? new FileMetaStore(directory) : new MemoryMetaStore(),
      createModel: apiKey ? () => new AnthropicModelClient({ apiKey }) : null,
    });
  }
  return globalStore.__abiAnalysisService;
}

export { MemoryMetaStore };

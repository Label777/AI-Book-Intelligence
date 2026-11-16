/**
 * Интерфейс модели для пайплайна. Шаги зависят только от него:
 * рабочая реализация — Claude API (anthropic.ts), в тестах — подставная модель.
 */
import type { z } from "zod";

import type { ModelTier } from "./config";

export interface Usage {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  webSearches: number;
}

export const ZERO_USAGE: Usage = {
  calls: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  webSearches: 0,
};

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    calls: a.calls + b.calls,
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
    webSearches: a.webSearches + b.webSearches,
  };
}

export interface ObjectRequest<T> {
  /** Имя задачи — для журнала и для подставной модели в тестах. */
  task: string;
  tier: ModelTier;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface ResearchRequest {
  task: string;
  tier: ModelTier;
  system: string;
  prompt: string;
  maxSearches: number;
}

/** Ссылка, которой модель подтвердила фрагмент своего ответа при веб-поиске. */
export interface WebCitation {
  url: string;
  title: string | null;
  /** Дословный фрагмент страницы — его возвращает API, а не пишет модель. */
  citedText: string;
}

export interface ResearchResult {
  text: string;
  citations: WebCitation[];
  usage: Usage;
}

export interface ModelClient {
  /** Идентификатор модели для уровня — входит в ключ кэша шага. */
  modelFor(tier: ModelTier): string;
  /** Ответ строго по схеме. */
  generateObject<T>(request: ObjectRequest<T>): Promise<{ object: T; usage: Usage }>;
  /** Ответ с веб-поиском: текст и дословные фрагменты найденных страниц. */
  research(request: ResearchRequest): Promise<ResearchResult>;
}

/** Обёртка, которая суммирует расход токенов всех вызовов — так шаг узнаёт свою стоимость. */
export function meter(client: ModelClient): { client: ModelClient; usage: () => Usage } {
  let total = ZERO_USAGE;
  return {
    usage: () => total,
    client: {
      modelFor: (tier) => client.modelFor(tier),
      async generateObject(request) {
        const result = await client.generateObject(request);
        total = addUsage(total, result.usage);
        return result;
      },
      async research(request) {
        const result = await client.research(request);
        total = addUsage(total, result.usage);
        return result;
      },
    },
  };
}

/** Цена за миллион токенов и за тысячу поисков; задаётся владельцем проекта по действующему тарифу. */
export interface Pricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
  webSearchPerK: number;
}

/** Стоимость расхода по заданному тарифу. Тарифы в код не зашиты: они меняются. */
export function costOf(usage: Usage, pricing: Pricing): number {
  return (
    (usage.inputTokens * pricing.inputPerMTok +
      usage.outputTokens * pricing.outputPerMTok +
      usage.cacheReadTokens * pricing.cacheReadPerMTok +
      usage.cacheWriteTokens * pricing.cacheWritePerMTok) /
      1_000_000 +
    (usage.webSearches * pricing.webSearchPerK) / 1000
  );
}

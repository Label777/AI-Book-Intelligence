/**
 * Реализация интерфейса модели на Claude API.
 *
 * - Ответы по схеме — через структурированный вывод (`output_config.format`).
 * - Поиск источников — серверный инструмент веб-поиска; из ответа берутся дословные
 *   фрагменты найденных страниц (`cited_text`), на которые ссылается модель.
 *
 * Ключ читается из переменной окружения ANTHROPIC_API_KEY и используется только на сервере.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { resolveModels, type ModelTier } from "./config";
import type {
  ModelClient,
  ObjectRequest,
  ResearchRequest,
  ResearchResult,
  Usage,
  WebCitation,
} from "./model";
import { addUsage, ZERO_USAGE } from "./model";

const DEFAULT_MAX_TOKENS = 6000;
const RESEARCH_MAX_TOKENS = 8000;
/** Сколько раз продолжать ответ, если API приостановил длинный ход с поиском. */
const MAX_CONTINUATIONS = 4;

function usageOf(message: Anthropic.Message): Usage {
  return {
    calls: 1,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
    webSearches: message.usage.server_tool_use?.web_search_requests ?? 0,
  };
}

export class AnthropicModelClient implements ModelClient {
  private readonly client: Anthropic;
  private readonly models: Record<ModelTier, string>;

  constructor(
    options: {
      apiKey?: string;
      models?: Record<ModelTier, string>;
      client?: Anthropic;
    } = {},
  ) {
    this.client = options.client ?? new Anthropic({ apiKey: options.apiKey });
    this.models = options.models ?? resolveModels();
  }

  modelFor(tier: ModelTier): string {
    return this.models[tier];
  }

  async generateObject<T>(
    request: ObjectRequest<T>,
  ): Promise<{ object: T; usage: Usage }> {
    const message = await this.client.messages.parse({
      model: this.modelFor(request.tier),
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
      output_config: { format: zodOutputFormat(request.schema) },
    });
    if (message.stop_reason === "refusal") {
      throw new Error(`Модель отказалась выполнять задачу «${request.task}».`);
    }
    if (message.stop_reason === "max_tokens") {
      throw new Error(`Ответ на задачу «${request.task}» не уместился в лимит токенов.`);
    }
    if (message.parsed_output === null || message.parsed_output === undefined) {
      throw new Error(`Ответ на задачу «${request.task}» не соответствует схеме.`);
    }
    return { object: message.parsed_output as T, usage: usageOf(message) };
  }

  async research(request: ResearchRequest): Promise<ResearchResult> {
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: request.prompt },
    ];
    const citations: WebCitation[] = [];
    let text = "";
    let usage = ZERO_USAGE;

    for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
      const message = await this.client.messages.create({
        model: this.modelFor(request.tier),
        max_tokens: RESEARCH_MAX_TOKENS,
        system: request.system,
        messages,
        tools: [
          {
            type: "web_search_20260318",
            name: "web_search",
            max_uses: request.maxSearches,
          },
        ],
      });
      usage = addUsage(usage, usageOf(message));

      for (const block of message.content) {
        if (block.type !== "text") continue;
        text += block.text;
        for (const citation of block.citations ?? []) {
          if (citation.type === "web_search_result_location") {
            citations.push({
              url: citation.url,
              title: citation.title,
              citedText: citation.cited_text,
            });
          }
        }
      }

      if (message.stop_reason === "refusal") {
        throw new Error(`Модель отказалась выполнять задачу «${request.task}».`);
      }
      // pause_turn: сервер прервал длинный ход с поиском — ответ продолжается с того же места.
      if (message.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: message.content });
    }
    return { text, citations, usage };
  }
}

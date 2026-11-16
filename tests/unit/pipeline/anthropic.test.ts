import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AnthropicModelClient } from "@/pipeline/anthropic";
import { resolveModels } from "@/pipeline/config";

const usage = (extra: Record<string, unknown> = {}) => ({
  input_tokens: 100,
  output_tokens: 40,
  cache_read_input_tokens: 10,
  cache_creation_input_tokens: null,
  ...extra,
});

/** Подменяет SDK: записывает запросы и по очереди возвращает заготовленные ответы. */
function fakeSdk(responses: unknown[]) {
  const requests: Record<string, unknown>[] = [];
  const next = async (params: Record<string, unknown>) => {
    // Копия через JSON: в запросе есть функция разбора ответа, а нужен снимок данных на момент вызова.
    requests.push(JSON.parse(JSON.stringify(params)));
    return responses.shift();
  };
  const client = { messages: { parse: next, create: next } } as unknown as Anthropic;
  return { client, requests };
}

const models = { fast: "m-fast", main: "m-main", deep: "m-deep" };
const schema = z.object({ answer: z.number() });
const request = {
  task: "t",
  tier: "deep" as const,
  system: "sys",
  prompt: "вопрос",
  schema,
};

describe("клиент Claude API", () => {
  it("модели берутся из переменных окружения, иначе — значения по умолчанию", () => {
    expect(resolveModels({})).toEqual({
      fast: "claude-haiku-5-5",
      main: "claude-sonnet-5-5",
      deep: "claude-opus-5-5",
    });
    expect(
      resolveModels({ AI_MODEL_MAIN: " custom-main ", AI_MODEL_FAST: "" }).main,
    ).toBe("custom-main");
    expect(resolveModels({ AI_MODEL_FAST: "" }).fast).toBe("claude-haiku-5-5");
  });

  it("запрашивает ответ по схеме и возвращает разобранный объект с расходом", async () => {
    const sdk = fakeSdk([
      { stop_reason: "end_turn", parsed_output: { answer: 4 }, usage: usage() },
    ]);
    const client = new AnthropicModelClient({ client: sdk.client, models });
    const result = await client.generateObject(request);
    expect(result.object).toEqual({ answer: 4 });
    expect(result.usage).toEqual({
      calls: 1,
      inputTokens: 100,
      outputTokens: 40,
      cacheReadTokens: 10,
      cacheWriteTokens: 0,
      webSearches: 0,
    });
    expect(sdk.requests[0]).toMatchObject({
      model: "m-deep",
      system: "sys",
      messages: [{ role: "user", content: "вопрос" }],
      output_config: { format: { type: "json_schema" } },
    });
  });

  it.each([
    ["refusal", { answer: 1 }, "отказалась"],
    ["max_tokens", null, "не уместился"],
    ["end_turn", null, "не соответствует схеме"],
  ])("ошибка при stop_reason=%s", async (stop_reason, parsed_output, message) => {
    const sdk = fakeSdk([{ stop_reason, parsed_output, usage: usage() }]);
    const client = new AnthropicModelClient({ client: sdk.client, models });
    await expect(client.generateObject(request)).rejects.toThrow(message);
  });

  it("поиск: собирает текст и дословные фрагменты страниц, считает запросы", async () => {
    const sdk = fakeSdk([
      {
        stop_reason: "end_turn",
        usage: usage({
          server_tool_use: { web_search_requests: 3, web_fetch_requests: 0 },
        }),
        content: [
          { type: "server_tool_use", id: "x", name: "web_search", input: {} },
          { type: "web_search_tool_result", tool_use_id: "x", content: [] },
          {
            type: "text",
            text: "Книга вышла в 2019 году.",
            citations: [
              {
                type: "web_search_result_location",
                url: "https://a.example/p",
                title: "Страница",
                cited_text: "вышла в 2019 году",
                encrypted_index: "i",
              },
              { type: "char_location", cited_text: "не из поиска" },
            ],
          },
          { type: "text", text: " Без ссылок.", citations: null },
        ],
      },
    ]);
    const client = new AnthropicModelClient({ client: sdk.client, models });
    const result = await client.research({
      task: "r",
      tier: "main",
      system: "sys",
      prompt: "найди",
      maxSearches: 6,
    });
    expect(result.text).toBe("Книга вышла в 2019 году. Без ссылок.");
    expect(result.citations).toEqual([
      { url: "https://a.example/p", title: "Страница", citedText: "вышла в 2019 году" },
    ]);
    expect(result.usage.webSearches).toBe(3);
    expect(sdk.requests[0]).toMatchObject({
      model: "m-main",
      tools: [{ type: "web_search_20260318", name: "web_search", max_uses: 6 }],
    });
  });

  it("поиск: продолжает приостановленный ход и складывает расход", async () => {
    const paused = {
      stop_reason: "pause_turn",
      usage: usage(),
      content: [{ type: "text", text: "Начало. ", citations: null }],
    };
    const done = {
      stop_reason: "end_turn",
      usage: usage(),
      content: [{ type: "text", text: "Конец.", citations: null }],
    };
    const sdk = fakeSdk([paused, done]);
    const client = new AnthropicModelClient({ client: sdk.client, models });
    const result = await client.research({
      task: "r",
      tier: "main",
      system: "s",
      prompt: "найди",
      maxSearches: 2,
    });
    expect(result.text).toBe("Начало. Конец.");
    expect(result.usage).toMatchObject({ calls: 2, inputTokens: 200 });
    expect(sdk.requests[1].messages).toEqual([
      { role: "user", content: "найди" },
      { role: "assistant", content: paused.content },
    ]);
  });

  it("поиск: отказ модели — ошибка", async () => {
    const sdk = fakeSdk([{ stop_reason: "refusal", usage: usage(), content: [] }]);
    const client = new AnthropicModelClient({ client: sdk.client, models });
    await expect(
      client.research({
        task: "r",
        tier: "main",
        system: "s",
        prompt: "p",
        maxSearches: 1,
      }),
    ).rejects.toThrow("отказалась");
  });
});

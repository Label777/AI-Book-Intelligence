/**
 * Контрольный прогон пайплайна на настоящей модели: `npm run eval`.
 *
 * Нужен ключ ANTHROPIC_API_KEY — без него прогон пропускается. Каждый запуск тратит токены.
 *   EVAL_BOOKS=atomic-habits,sapiens   какие книги из evals/books.json прогонять (по умолчанию первая)
 *   EVAL_LANGUAGE=ru|en                язык анализа (по умолчанию ru)
 * Результаты шагов сохраняются в evals/out/<книга>/ — прерванный прогон продолжается,
 * повторный запуск без изменений ничего не тратит.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { analyzeBook } from "@/pipeline";
import { AnthropicModelClient } from "@/pipeline/anthropic";
import { FilePipelineStore } from "@/pipeline/file-store";
import { addUsage, ZERO_USAGE } from "@/pipeline/model";
import type { Book } from "@/pipeline/schema";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
const language = process.env.EVAL_LANGUAGE === "en" ? "en" : "ru";

interface EvalBook extends Omit<Book, "workId" | "description"> {
  slug: string;
}

describe.skipIf(!hasKey)("контрольные книги на настоящей модели", () => {
  it(
    "прогон выбранных книг",
    async () => {
      const all = JSON.parse(
        await readFile(path.join(HERE, "books.json"), "utf8"),
      ) as EvalBook[];
      const wanted = process.env.EVAL_BOOKS?.split(",").map((slug) => slug.trim());
      const books = wanted
        ? all.filter((book) => wanted.includes(book.slug))
        : all.slice(0, 1);
      expect(books.length).toBeGreaterThan(0);

      const store = new FilePipelineStore(path.join(HERE, "out"));
      const model = new AnthropicModelClient();
      const summary: Record<string, unknown>[] = [];

      for (const { slug, ...book } of books) {
        const analysisId = `${slug}-${language}`;
        const startedAt = Date.now();
        const result = await analyzeBook({
          analysisId,
          store,
          model,
          request: {
            book: { ...book, workId: `eval:${slug}`, description: null },
            mode: "sources_only",
            language,
          },
          onEvent: (event) => console.log(`[${slug}]`, JSON.stringify(event)),
        });
        const steps = await store.listSteps(analysisId);
        const usage = steps.reduce(
          (total, step) => addUsage(total, step.usage),
          ZERO_USAGE,
        );
        summary.push({
          book: slug,
          status: result.status,
          stoppedAt: result.stoppedAt,
          reason: result.reason,
          coverage: result.state.sources?.coverage.level,
          tocVerified: result.state.sources?.toc.verified,
          ...result.state.verified?.report,
          ...usage,
          /** Время этого запуска; шаги, взятые из сохранённых результатов, в него не входят. */
          seconds: Math.round((Date.now() - startedAt) / 1000),
          model: {
            fast: model.modelFor("fast"),
            main: model.modelFor("main"),
            deep: model.modelFor("deep"),
          },
        });
        // Итог пишем после каждой книги: если прогон оборвётся, готовое не пропадёт.
        await mkdir(path.join(HERE, "out"), { recursive: true });
        await writeFile(
          path.join(HERE, "out", "summary.json"),
          `${JSON.stringify(summary, null, 2)}\n`,
        );
      }
      console.table(summary);
    },
    60 * 60 * 1000,
  );
});

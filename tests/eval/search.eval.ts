import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { isDerivative } from "@/books/rank";
import { searchBooks } from "@/books/search";
import { tokenize, tokensMatch } from "@/books/text";
import type { RankedCandidate, SearchOutcome } from "@/books/types";
import { getBook } from "@/books/work";
import { EVAL_CASES, type EvalCase } from "./queries";

/** Подходит ли кандидат под ожидание: слово в названии, фамилия среди авторов, не пересказ. */
function matches(candidate: RankedCandidate, testCase: EvalCase): boolean {
  const titleTokens = tokenize([candidate.title, candidate.subtitle ?? ""].join(" "));
  const authorTokens = tokenize(candidate.authors.join(" "));
  return (
    !isDerivative(candidate.title) &&
    titleTokens.some(
      (token) =>
        tokensMatch(testCase.title, token) ||
        (testCase.titleEn !== undefined && tokensMatch(testCase.titleEn, token)),
    ) &&
    authorTokens.some(
      (token) =>
        tokensMatch(testCase.author, token) ||
        (testCase.authorEn !== undefined && tokensMatch(testCase.authorEn, token)),
    )
  );
}

interface Row {
  kind: string;
  query: string;
  ok: boolean;
  position: number | null;
  strategy?: string;
  confidence?: string;
  top: string[];
  error?: string;
}

it("живой поиск: нужная книга в первой тройке не реже чем в 90 % случаев", async () => {
  const rows: Row[] = [];
  for (const testCase of EVAL_CASES) {
    let outcome: SearchOutcome | undefined;
    let error: string | undefined;
    try {
      outcome = await searchBooks(testCase.query, { cache: null });
    } catch (cause) {
      error = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
    }
    const index =
      outcome?.candidates.findIndex((candidate) => matches(candidate, testCase)) ?? -1;
    rows.push({
      kind: testCase.kind,
      query: testCase.query,
      ok: index >= 0 && index < 3,
      position: index >= 0 ? index + 1 : null,
      strategy: outcome?.strategy,
      confidence: outcome?.confidence,
      top: (outcome?.candidates ?? [])
        .slice(0, 3)
        .map(
          (item) =>
            `${item.title} — ${item.authors[0] ?? "?"} (${item.score.toFixed(2)})`,
        ),
      error,
    });
  }

  // Заодно проверяем страницу книги на настоящих данных.
  let book: unknown;
  try {
    const details = await getBook("OL17075811W");
    book = details && {
      title: details.title,
      authors: details.authors,
      year: details.firstPublishYear,
      editionTotal: details.editionTotal,
      editionsLoaded: details.editions.length,
      languages: [...new Set(details.editions.flatMap((edition) => edition.languages))]
        .length,
      hasCover: Boolean(details.coverUrl),
      hasDescription: Boolean(details.description),
    };
  } catch (cause) {
    book = { error: String(cause) };
  }

  const hits = rows.filter((row) => row.ok).length;
  const report = { total: rows.length, hits, rate: hits / rows.length, book, rows };
  writeFileSync("search-eval.json", JSON.stringify(report, null, 2));

  expect(report.rate, `в первой тройке ${hits} из ${rows.length}`).toBeGreaterThanOrEqual(
    0.9,
  );
}, 600_000);

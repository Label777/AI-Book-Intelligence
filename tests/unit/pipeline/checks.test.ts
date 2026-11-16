import { describe, expect, it } from "vitest";

import { checkAction } from "@/pipeline/checks/actions";
import {
  checkGrounding,
  checkQuotes,
  enforceQuoteBudget,
  isExactQuote,
  quotedSpans,
} from "@/pipeline/checks/claims";
import { buildCoverage, verifyToc } from "@/pipeline/checks/coverage";
import { checkDiagram } from "@/pipeline/checks/diagram";
import { findDuplicates } from "@/pipeline/checks/duplicates";
import { LIMITS } from "@/pipeline/config";
import type { Claim, Source } from "@/pipeline/schema";
import { domainOf, normalizeForMatch, similarity, truncate } from "@/pipeline/text";

const source = (
  id: string,
  kind: Source["kind"],
  domain: string | null,
  texts: string[],
): Source => ({
  id,
  kind,
  title: id,
  url: domain ? `https://${domain}/page` : null,
  domain,
  retrievedAt: "2026-11-16T00:00:00Z",
  reliability: "medium",
  excerpts: texts.map((text, i) => ({ id: `${id}e${i + 1}`, text })),
});

const claim = (over: Partial<Claim> & Pick<Claim, "id" | "type">): Claim => ({
  text: "Утверждение о книге.",
  evidence: [],
  basedOn: [],
  quote: null,
  verification: "unverified",
  downgradedFrom: null,
  ...over,
});

const SOURCES = [
  source("s1", "description", null, [
    "Автор предлагает метод трёх фильтров: источник, срок и цена ошибки.",
  ]),
  source("s2", "research", "journal.example", [
    "Операторы с меньшим числом оповещений реже ошибались.",
  ]),
];
const codes = (claims: Claim[]) => checkGrounding(claims, SOURCES).map((p) => p.code);

describe("текст", () => {
  it("нормализация сглаживает регистр, ё, кавычки и тире", () => {
    expect(normalizeForMatch("  «Ёлка» —  это “дерево”  ")).toBe('"елка" - это "дерево"');
  });
  it("похожесть: одинаковые тексты — 1, разные по смыслу — низкая", () => {
    expect(
      similarity("Внимание — дефицитный ресурс", "внимание - дефицитный ресурс"),
    ).toBe(1);
    expect(
      similarity("Внимание руководителя ограничено", "Диспетчеры сократили оповещения"),
    ).toBeLessThan(0.3);
    expect(similarity("", "")).toBe(0);
  });
  it("похожесть устойчива к окончаниям слов", () => {
    expect(
      similarity(
        "Необработанные сообщения снижают качество решений",
        "Необработанное сообщение снижает качество решения",
      ),
    ).toBeGreaterThan(0.72);
  });
  it("домен без www, обрезка по границе слова", () => {
    expect(domainOf("https://www.Example.org/a?b=1")).toBe("example.org");
    expect(domainOf("не адрес")).toBeNull();
    expect(truncate("один два три четыре", 12)).toBe("один два");
    expect(truncate("  коротко  ", 50)).toBe("коротко");
  });
});

describe("привязка утверждений к источникам", () => {
  it("факт без выдержки, с несуществующим источником или выдержкой отклоняется", () => {
    expect(codes([claim({ id: "c1", type: "book_fact" })])).toEqual(["no_evidence"]);
    expect(
      codes([
        claim({
          id: "c1",
          type: "book_fact",
          evidence: [{ sourceId: "s1", excerptId: null }],
        }),
      ]),
    ).toEqual(["no_evidence"]);
    expect(
      codes([
        claim({
          id: "c1",
          type: "book_fact",
          evidence: [{ sourceId: "s9", excerptId: "s9e1" }],
        }),
      ]),
    ).toEqual(["unknown_source", "no_evidence"]);
    expect(
      codes([
        claim({
          id: "c1",
          type: "book_fact",
          evidence: [{ sourceId: "s1", excerptId: "s1e7" }],
        }),
      ]),
    ).toContain("unknown_excerpt");
    expect(
      codes([
        claim({
          id: "c1",
          type: "book_fact",
          evidence: [{ sourceId: "s1", excerptId: "s1e1" }],
        }),
      ]),
    ).toEqual([]);
  });
  it("внешнее исследование не может опираться только на описание самой книги", () => {
    const own = claim({
      id: "c1",
      type: "external_research",
      evidence: [{ sourceId: "s1", excerptId: "s1e1" }],
    });
    const outside = claim({
      id: "c2",
      type: "external_research",
      evidence: [{ sourceId: "s2", excerptId: "s2e1" }],
    });
    expect(codes([own])).toEqual(["wrong_source_kind"]);
    expect(codes([outside])).toEqual([]);
  });
  it("интерпретация и критика требуют оснований; ссылки должны существовать", () => {
    const fact = claim({
      id: "c1",
      type: "book_fact",
      evidence: [{ sourceId: "s1", excerptId: "s1e1" }],
    });
    expect(codes([claim({ id: "c2", type: "ai_interpretation" })])).toEqual(["no_basis"]);
    expect(codes([fact, claim({ id: "c2", type: "critique", basedOn: ["c1"] })])).toEqual(
      [],
    );
    expect(codes([claim({ id: "c2", type: "critique", basedOn: ["c7"] })])).toEqual([
      "unknown_basis",
    ]);
    expect(
      codes([claim({ id: "c2", type: "ai_interpretation", basedOn: ["c2"] })]),
    ).toEqual(["self_reference"]);
  });
  it("слишком длинное и пустое утверждение отклоняются", () => {
    const base = {
      id: "c1",
      type: "book_fact" as const,
      evidence: [{ sourceId: "s1", excerptId: "s1e1" }],
    };
    expect(
      codes([claim({ ...base, text: "я".repeat(LIMITS.claimMaxChars + 1) })]),
    ).toEqual(["too_long"]);
    expect(codes([claim({ ...base, text: "   " })])).toEqual(["empty_text"]);
  });
});

describe("цитаты", () => {
  const evidence = [{ sourceId: "s1", excerptId: "s1e1" }];
  it("точное совпадение не зависит от регистра, кавычек и пробелов", () => {
    expect(isExactQuote("«Метод трёх  фильтров»", SOURCES[0].excerpts[0].text)).toBe(
      true,
    );
    expect(isExactQuote("метод четырёх фильтров", SOURCES[0].excerpts[0].text)).toBe(
      false,
    );
    expect(isExactQuote("   ", SOURCES[0].excerpts[0].text)).toBe(false);
  });
  it("цитата должна дословно совпадать с выдержкой и укладываться в лимит", () => {
    const ok = claim({
      id: "c1",
      type: "book_fact",
      evidence,
      quote: { text: "источник, срок и цена ошибки", excerptId: "s1e1" },
    });
    const changed = claim({
      id: "c2",
      type: "book_fact",
      evidence,
      quote: { text: "источник, срок и цена успеха", excerptId: "s1e1" },
    });
    const foreign = claim({
      id: "c3",
      type: "book_fact",
      evidence,
      quote: { text: "меньшим числом оповещений", excerptId: "s2e1" },
    });
    const long = claim({
      id: "c4",
      type: "book_fact",
      evidence,
      quote: { text: "я".repeat(LIMITS.quoteMaxChars + 1), excerptId: "s1e1" },
    });
    expect(checkQuotes([ok], SOURCES)).toEqual([]);
    expect(checkQuotes([changed, foreign, long], SOURCES).map((p) => p.code)).toEqual([
      "quote_not_found",
      "quote_not_found",
      "quote_too_long",
    ]);
  });
  it("длинный фрагмент в кавычках внутри текста считается цитатой, короткий термин — нет", () => {
    expect(quotedSpans("Правило «один канал» работает")).toEqual([]);
    expect(
      quotedSpans('Он сказал: "тишина есть высшая форма управления организацией"'),
    ).toHaveLength(1);
    const invented = claim({
      id: "c1",
      type: "book_fact",
      evidence,
      text: "Автор пишет: «тишина есть высшая форма управления организацией».",
    });
    const real = claim({
      id: "c2",
      type: "book_fact",
      evidence,
      text: "В описании сказано: «Автор предлагает метод трёх фильтров: источник, срок и цена ошибки».",
    });
    expect(
      checkQuotes([invented, real], SOURCES).map((p) => [p.claimId, p.code]),
    ).toEqual([["c1", "unmarked_quote"]]);
  });
  it("лишние цитаты сверх лимита снимаются, утверждения остаются", () => {
    const quoted = [1, 2, 3].map((n) =>
      claim({
        id: `c${n}`,
        type: "book_fact",
        quote: { text: "срок", excerptId: "s1e1" },
      }),
    );
    const result = enforceQuoteBudget(quoted, 2);
    expect(result.map((c) => c.quote !== null)).toEqual([true, true, false]);
  });
});

describe("повторы", () => {
  it("близкие формулировки считаются повтором, остаётся более ранняя", () => {
    const pairs = findDuplicates([
      { id: "a", text: "Необработанные сообщения снижают качество решений." },
      { id: "b", text: "Срочное должно приходить одним каналом." },
      { id: "c", text: "Необработанное сообщение снижает качество решения" },
    ]);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ keep: "a", drop: "c" });
  });
  it("разные мысли на одну тему повтором не считаются", () => {
    expect(
      findDuplicates([
        { id: "a", text: "Отчёт, который никто не читает, создаёт иллюзию контроля." },
        { id: "b", text: "Прежде чем добавлять новый отчёт, стоит отменить старый." },
      ]),
    ).toEqual([]);
  });
});

describe("конкретность действий", () => {
  const good = {
    text: "В пятницу вечером посчитать непрочитанные сообщения в трёх главных каналах.",
    object: "непрочитанные сообщения",
    when: "в пятницу вечером",
    horizon: "7d" as const,
    context: "work" as const,
  };
  it("конкретный шаг проходит", () => {
    expect(checkAction(good)).toEqual([]);
  });
  it("без объекта, без условия, слишком короткое или слишком длинное — отклоняется", () => {
    expect(checkAction({ ...good, object: " " })).toHaveLength(1);
    expect(checkAction({ ...good, when: "" })).toHaveLength(1);
    expect(checkAction({ ...good, text: "Считать письма." })).toHaveLength(1);
    expect(checkAction({ ...good, text: "Считать ".repeat(60) })).toHaveLength(1);
  });
  it.each([
    "Старайтесь чаще разбирать почту по вечерам в пятницу.",
    "Важно помнить о цене ошибки при чтении писем.",
    "Try to be more careful with every incoming message.",
  ])("совет общего вида отклоняется: %s", (text) => {
    expect(checkAction({ ...good, text })).toHaveLength(1);
  });
  it("слово, которое лишь начинается так же, не считается размытым началом", () => {
    expect(
      checkAction({
        ...good,
        text: "Стоимость ошибки записать рядом с каждым срочным письмом за день.",
      }),
    ).toEqual([]);
  });
});

describe("схемы", () => {
  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ label: `Шаг ${i + 1}`, note: null }));
  it("число элементов и осей зависит от типа", () => {
    expect(
      checkDiagram({ type: "cycle", title: "Цикл", items: items(4), axes: [] }),
    ).toEqual([]);
    expect(
      checkDiagram({ type: "cycle", title: "Цикл", items: items(2), axes: [] }),
    ).toHaveLength(1);
    expect(
      checkDiagram({
        type: "matrix",
        title: "Матрица",
        items: items(4),
        axes: ["Срок", "Цена"],
      }),
    ).toEqual([]);
    expect(
      checkDiagram({ type: "matrix", title: "Матрица", items: items(3), axes: [] }),
    ).toHaveLength(2);
    expect(
      checkDiagram({
        type: "comparison",
        title: "Сравнение",
        items: items(3),
        axes: ["А", "Б"],
      }),
    ).toEqual([]);
  });
  it("пустые и слишком длинные подписи, отсутствие названия — отклоняются", () => {
    const long = { label: "я".repeat(LIMITS.diagramLabelMaxChars + 1), note: null };
    expect(
      checkDiagram({
        type: "flow",
        title: " ",
        items: [...items(2), long, { label: " ", note: null }],
        axes: [],
      }),
    ).toHaveLength(3);
  });
});

describe("оглавление и покрытие", () => {
  const reviewA = source("s3", "review", "a.example", [
    "Оглавление: Шум, Фильтры, Тишина.",
  ]);
  const reviewB = source("s4", "review", "b.example", ["Главы: Шум; Фильтры; Тишина."]);
  const sameSite = source("s5", "review", "a.example", ["Шум, Фильтры, Тишина"]);
  const chapters = ["Шум", "Фильтры", "Тишина"];

  it("оглавление подтверждается совпадением в двух независимых источниках", () => {
    const toc = verifyToc(
      [
        { sourceId: "s3", chapters },
        { sourceId: "s4", chapters: ["шум", "Фильтры", "Тишина"] },
      ],
      [reviewA, reviewB],
    );
    expect(toc).toMatchObject({ verified: true, chapters, sourceIds: ["s3", "s4"] });
  });
  it("один источник, один и тот же сайт или расхождение в главах — не подтверждает", () => {
    expect(verifyToc([{ sourceId: "s3", chapters }], [reviewA]).verified).toBe(false);
    expect(
      verifyToc(
        [
          { sourceId: "s3", chapters },
          { sourceId: "s5", chapters },
        ],
        [reviewA, sameSite],
      ).verified,
    ).toBe(false);
    expect(
      verifyToc(
        [
          { sourceId: "s3", chapters },
          { sourceId: "s4", chapters: ["Введение", "Метод", "Практика", "Итоги"] },
        ],
        [reviewA, reviewB],
      ).verified,
    ).toBe(false);
    expect(
      verifyToc(
        [
          { sourceId: "s3", chapters: ["Шум", "Фильтры"] },
          { sourceId: "s4", chapters: ["Шум", "Фильтры"] },
        ],
        [reviewA, reviewB],
      ).verified,
    ).toBe(false);
  });
  it("оглавление из текста самой книги достаточно одно", () => {
    const text = source("s6", "user_text", null, ["Шум Фильтры Тишина"]);
    expect(verifyToc([{ sourceId: "s6", chapters }], [text]).verified).toBe(true);
  });

  const description = source("s0", "description", null, ["Описание книги."]);
  it("описание и два независимых источника о содержании — достаточно", () => {
    const coverage = buildCoverage([description, reviewA, reviewB], true);
    expect(coverage).toMatchObject({
      level: "sufficient",
      independentContentSources: 2,
      hasCriticism: true,
      missing: [],
    });
  });
  it("два источника с одного сайта считаются одним", () => {
    const coverage = buildCoverage([description, reviewA, sameSite], false);
    expect(coverage.independentContentSources).toBe(1);
    expect(coverage.level).toBe("limited");
    expect(coverage.missing.some((m) => m.includes("оглавление"))).toBe(true);
  });
  it("только описание или пустые источники — недостаточно", () => {
    expect(buildCoverage([description], false).level).toBe("insufficient");
    expect(
      buildCoverage([description, source("s3", "review", "a.example", [])], false).level,
    ).toBe("insufficient");
    expect(buildCoverage([], false).level).toBe("insufficient");
  });
});

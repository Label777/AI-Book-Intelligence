import { describe, expect, it } from "vitest";

import { ClaimRegistry } from "@/pipeline/claims";
import { LIMITS } from "@/pipeline/config";
import { prune } from "@/pipeline/prune";
import type { Claim, Content, Source } from "@/pipeline/schema";
import { assembleSlides, chunk } from "@/pipeline/steps/assemble";
import { reviewDrafts } from "@/pipeline/steps/shared";

import { BOOK } from "./fixture";

const claim = (
  id: string,
  type: Claim["type"],
  basedOn: string[] = [],
  evidence: Claim["evidence"] = [],
): Claim => ({
  id,
  type,
  text: `Утверждение ${id}`,
  evidence,
  basedOn,
  quote: null,
  verification: "unverified",
  downgradedFrom: null,
});

/** Содержание наибольшего объёма: по максимуму элементов в каждом разделе. */
function fullContent(conceptCount: number, unitCount = 7): Content {
  const ids = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
  const actions = ids("a", 20).map((id, i) => ({
    id,
    claimId: "c1",
    text: `Действие ${id}`,
    object: "объект",
    when: "сегодня",
    horizon: (["24h", "7d", "30d"] as const)[i % 3],
    context: (["work", "business", "life"] as const)[i % 3],
  }));
  return {
    structure: {
      kind: "themes",
      verified: false,
      tocSourceIds: [],
      units: ids("u", unitCount).map((id) => ({ id, title: `Тема ${id}` })),
    },
    overview: { problem: "c1", intent: "c1", solution: "c1", audience: "c1" },
    units: ids("u", unitCount).map((unitId) => ({
      unitId,
      facts: ["c1", "c1"],
      conclusion: "c1",
      link: "c1",
    })),
    ideas: ids("idea", 10).map((id, i) => ({
      id,
      title: `Идея ${i + 1}`,
      statement: "c1",
      explanation: "c1",
      importance: "c1",
      actionId: `a${i + 1}`,
    })),
    concepts: ids("concept", conceptCount).map((id, i) => ({
      id,
      name: `Концепция ${i + 1}`,
      kind: "model",
      statement: "c1",
      explanation: "c1",
      diagram: {
        type: "flow",
        title: "Схема",
        items: [1, 2, 3].map((n) => ({ label: `Шаг ${n}`, note: null })),
        axes: [],
      },
    })),
    insights: ids("insight", 10).map((id, i) => ({
      id,
      essence: "c1",
      explanation: "c1",
      example: "c1",
      mindShift: "c1",
      actionId: `a${i + 11}`,
    })),
    worldview: { lens: "c1", beliefs: ["c1", "c1"], thinkingModel: "c1" },
    critique: {
      strengths: ["c1", "c1", "c1"],
      weaknesses: ["c1", "c1", "c1"],
      disputed: ["c1", "c1"],
      unproven: ["c1"],
      outdated: ["c1"],
      contradicted: ["c1"],
    },
    connections: {
      theories: [{ name: "Теория", relation: "c1" }],
      books: [{ title: "Книга", author: "Автор", relation: "c1" }],
      combinations: ["c1"],
    },
    takeaways: { main: "c1", items: ids("x", 10).map(() => "c1") },
    scores: (
      [
        "depth",
        "practicality",
        "originality",
        "rigor",
        "relevance",
        "difficulty",
      ] as const
    ).map((dimension) => ({ dimension, value: 7, rationale: "c1" })),
    highlights: (["strongest", "underrated", "disputed", "practical"] as const).map(
      (kind) => ({ kind, ideaId: "idea1", reason: "c1" }),
    ),
    actions,
  };
}

const assemble = (content: Content) =>
  assembleSlides({ book: BOOK, mode: "sources_only", content, language: "ru" });
const count = (slides: ReturnType<typeof assemble>, section: string) =>
  slides.filter((s) => s.section === section).length;

describe("сборка презентации", () => {
  it("делит список на почти равные части", () => {
    expect(chunk([1, 2, 3, 4, 5, 6, 7], 6)).toEqual([
      [1, 2, 3, 4],
      [5, 6, 7],
    ]);
    expect(chunk([], 4)).toEqual([]);
    expect(chunk([1, 2], 4)).toEqual([[1, 2]]);
  });

  it("при максимальном объёме укладывается в 20 слайдов и объединяет концепции", () => {
    const slides = assemble(fullContent(5));
    expect(slides).toHaveLength(LIMITS.maxSlides);
    expect(count(slides, "ideas")).toBe(2);
    expect(count(slides, "units")).toBe(2);
    expect(count(slides, "insights")).toBe(3);
    expect(count(slides, "practice")).toBe(2);
    expect(count(slides, "critique")).toBe(2);
    const concepts = slides.filter((s) => s.section === "concepts");
    expect(concepts.map((s) => s.template)).toEqual(["concept", "concepts"]);
    // Первая концепция — на своём слайде со схемой, остальные четыре объединены.
    expect(concepts[0].blocks.some((b) => b.kind === "diagram")).toBe(true);
    expect(concepts[1].blocks).toHaveLength(4);
    expect(slides.map((s) => s.id)).toEqual(slides.map((_, i) => `sl${i + 1}`));
  });

  it("порядок разделов соответствует ТЗ", () => {
    const sections = [...new Set(assemble(fullContent(2)).map((s) => s.section))];
    expect(sections).toEqual([
      "cover",
      "overview",
      "ideas",
      "units",
      "concepts",
      "insights",
      "practice",
      "worldview",
      "critique",
      "connections",
      "takeaways",
      "plan",
      "scores",
    ]);
  });

  it("трём концепциям достаётся по слайду, когда есть место", () => {
    const content = fullContent(3);
    content.ideas = content.ideas.slice(0, 5);
    content.insights = content.insights.slice(0, 5);
    const slides = assemble(content);
    expect(slides.filter((s) => s.template === "concept")).toHaveLength(3);
    expect(slides.length).toBeLessThanOrEqual(LIMITS.maxSlides);
  });

  it("длинное оглавление занимает не больше двух слайдов", () => {
    expect(count(assemble(fullContent(1, 18)), "units")).toBe(2);
  });

  it("разбор по темам сопровождается пояснением, а глава без данных — пометкой", () => {
    const content = fullContent(1, 3);
    content.units[1] = { unitId: "u2", facts: [], conclusion: null, link: null };
    const [slide] = assemble(content).filter((s) => s.section === "units");
    expect(slide.blocks[0]).toMatchObject({ kind: "note" });
    expect(slide.blocks[2]).toMatchObject({
      kind: "item",
      subtitle: "В источниках нет сведений о содержании этой части.",
    });
  });

  it("пустой раздел не даёт слайда", () => {
    const content = fullContent(0);
    content.insights = [];
    content.worldview = { lens: null, beliefs: [], thinkingModel: null };
    content.scores = [];
    content.highlights = [];
    const sections = new Set(assemble(content).map((s) => s.section));
    for (const section of ["concepts", "insights", "worldview", "scores"])
      expect(sections.has(section as never)).toBe(false);
  });

  it("план показывает не больше четырёх действий на каждый срок, оценки — с оговоркой", () => {
    const slides = assemble(fullContent(1));
    const plan = slides.find((s) => s.section === "plan")!;
    const groups = plan.blocks.map((b) => b.group);
    for (const group of ["Первые 24 часа", "Первые 7 дней", "Первые 30 дней"]) {
      expect(groups.filter((g) => g === group)).toHaveLength(4);
    }
    const scores = slides.find((s) => s.section === "scores")!;
    expect(scores.blocks[0]).toMatchObject({
      kind: "note",
      text: expect.stringContaining("не научный рейтинг"),
    });
    expect(slides[0].blocks.at(-1)).toMatchObject({
      kind: "note",
      text: "Анализ по открытым источникам",
    });
  });

  it("подписи переводятся на английский", () => {
    const slides = assembleSlides({
      book: BOOK,
      mode: "sources_only",
      content: fullContent(1),
      language: "en",
    });
    expect(slides.find((s) => s.section === "takeaways")!.title).toBe("Key takeaways");
  });
});

describe("удаление неподтверждённого", () => {
  const claims = [
    claim("c1", "book_fact", [], [{ sourceId: "s1", excerptId: "s1e1" }]),
    claim("c2", "book_fact", [], [{ sourceId: "s1", excerptId: "s1e1" }]),
    claim("c3", "ai_interpretation", ["c1"]),
    claim("c4", "ai_interpretation", ["c3"]),
    claim("c5", "ai_interpretation", ["c1", "c2"]),
    claim("c6", "critique", ["c1"], [{ sourceId: "s1", excerptId: null }]),
  ];
  const content = (): Content => ({
    ...fullContent(0, 1),
    overview: { problem: "c1", intent: "c3", solution: "c2", audience: null },
    units: [{ unitId: "u1", facts: ["c1", "c2"], conclusion: "c4", link: null }],
    ideas: [
      {
        id: "idea1",
        title: "А",
        statement: "c3",
        explanation: "c5",
        importance: null,
        actionId: "a1",
      },
      {
        id: "idea2",
        title: "Б",
        statement: "c5",
        explanation: "c4",
        importance: null,
        actionId: "a2",
      },
    ],
    insights: [],
    takeaways: { main: "c4", items: ["c5", "c6"] },
    scores: [
      { dimension: "depth", value: 5, rationale: "c3" },
      { dimension: "rigor", value: 5, rationale: "c5" },
    ],
    highlights: [
      { kind: "strongest", ideaId: "idea1", reason: "c5" },
      { kind: "practical", ideaId: "idea2", reason: "c4" },
    ],
    actions: [
      {
        id: "a1",
        claimId: "c3",
        text: "т",
        object: "о",
        when: "к",
        horizon: "24h",
        context: "work",
      },
      {
        id: "a2",
        claimId: "c5",
        text: "т",
        object: "о",
        when: "к",
        horizon: "7d",
        context: "work",
      },
    ],
  });

  it("каскадом убирает выводы без оснований и всё, что на них держалось", () => {
    const result = prune(claims, content(), ["c1"]);
    // c3 держался только на c1, c4 — только на c3; c5 сохраняет c2, c6 — собственный источник.
    expect(result.cascaded.sort()).toEqual(["c3", "c4"]);
    expect(result.claims.map((c) => c.id)).toEqual(["c2", "c5", "c6"]);
    expect(result.claims.find((c) => c.id === "c5")!.basedOn).toEqual(["c2"]);

    const c = result.content;
    expect(c.overview).toEqual({
      problem: null,
      intent: null,
      solution: "c2",
      audience: null,
    });
    expect(c.units[0]).toEqual({
      unitId: "u1",
      facts: ["c2"],
      conclusion: null,
      link: null,
    });
    expect(c.ideas).toEqual([
      {
        id: "idea2",
        title: "Б",
        statement: "c5",
        explanation: null,
        importance: null,
        actionId: "a2",
      },
    ]);
    expect(c.actions.map((a) => a.id)).toEqual(["a2"]);
    expect(c.takeaways).toEqual({ main: null, items: ["c5", "c6"] });
    expect(c.scores.map((s) => s.dimension)).toEqual(["rigor"]);
    expect(c.highlights).toEqual([{ kind: "strongest", ideaId: null, reason: "c5" }]);
  });

  it("ничего не меняет, когда удалять нечего", () => {
    const result = prune(claims, content(), []);
    expect(result.claims).toHaveLength(claims.length);
    expect(result.cascaded).toEqual([]);
    expect(result.content.ideas).toHaveLength(2);
  });
});

describe("приём черновиков", () => {
  const sources: Source[] = [
    {
      id: "s1",
      kind: "review",
      title: "Р",
      url: "https://a.example",
      domain: "a.example",
      retrievedAt: "2026-11-16",
      reliability: "medium",
      excerpts: [{ id: "s1e1", text: "Автор описывает метод трёх фильтров." }],
    },
  ];
  const draft = (
    key: string,
    type: Claim["type"],
    basedOn: string[],
    withEvidence = false,
  ) => ({
    key,
    type,
    text: `Черновик ${key}`,
    evidence: withEvidence ? [{ sourceId: "s1", excerptId: "s1e1" }] : [],
    basedOn,
    quote: "",
  });

  it("переводит метки в идентификаторы и продолжает нумерацию", () => {
    const existing = [
      claim("c7", "book_fact", [], [{ sourceId: "s1", excerptId: "s1e1" }]),
    ];
    const f = draft("f1", "book_fact", [], true);
    const i = draft("i1", "ai_interpretation", ["f1", "c7"]);
    const review = reviewDrafts([f, i], existing, sources);
    expect(review.problems).toEqual([]);
    expect(review.idOf(f)).toBe("c8");
    expect(review.idOf(i)).toBe("c9");
    expect(review.claims.find((c) => c.id === "c9")!.basedOn).toEqual(["c8", "c7"]);
  });

  it("отбрасывает факт без опоры и по цепочке всё, что опиралось только на него", () => {
    const bad = draft("f1", "book_fact", []);
    const good = draft("f2", "book_fact", [], true);
    const onBad = draft("i1", "ai_interpretation", ["f1"]);
    const onBoth = draft("i2", "ai_interpretation", ["f1", "f2"]);
    const chain = draft("i3", "critique", ["i1"]);
    const review = reviewDrafts([bad, good, onBad, onBoth, chain], [], sources);
    expect(review.idOf(bad)).toBeNull();
    expect(review.idOf(onBad)).toBeNull();
    expect(review.idOf(chain)).toBeNull();
    expect(review.idOf(good)).not.toBeNull();
    expect(review.claims.find((c) => c.id === review.idOf(onBoth))!.basedOn).toEqual([
      review.idOf(good),
    ]);
    expect(review.problems.some((p) => p.startsWith("[f1]"))).toBe(true);
  });

  it("отклоняет повторяющиеся метки и метки, похожие на существующие идентификаторы", () => {
    const existing = [
      claim("c1", "book_fact", [], [{ sourceId: "s1", excerptId: "s1e1" }]),
    ];
    const first = draft("f1", "book_fact", [], true);
    const twin = draft("f1", "book_fact", [], true);
    const clash = draft("c1", "book_fact", [], true);
    const review = reviewDrafts([first, twin, clash], existing, sources);
    expect(review.claims).toHaveLength(2);
    expect(review.problems).toHaveLength(2);
    expect(review.idOf(null)).toBeNull();
  });

  it("реестр продолжает нумерацию после существующих утверждений", () => {
    const registry = new ClaimRegistry([claim("c41", "book_fact")]);
    const map = registry.add([{ ...draft("x", "book_fact", [], true), quote: null }]);
    expect(map.get("x")).toBe("c42");
    registry.remove(["c42"]);
    expect(registry.all().map((c) => c.id)).toEqual(["c41"]);
  });
});

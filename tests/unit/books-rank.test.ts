import { describe, expect, it } from "vitest";
import { parseSearchResponse } from "@/books/openlibrary/parse";
import {
  assessConfidence,
  isDerivative,
  mergeDuplicates,
  rankCandidates,
} from "@/books/rank";
import type { BookCandidate } from "@/books/types";
import { fixture } from "./fixtures";

const book = (overrides: Partial<BookCandidate>): BookCandidate => ({
  workId: "OL1W",
  title: "Название",
  authors: [],
  languages: [],
  ...overrides,
});

const sapiens = () => parseSearchResponse(fixture("search-sapiens.json")).candidates;

describe("isDerivative", () => {
  it("узнаёт пересказы и конспекты", () => {
    expect(isDerivative("Summary of Sapiens by Yuval Noah Harari")).toBe(true);
    expect(isDerivative("Sapiens: Study Guide")).toBe(true);
    expect(isDerivative("Краткое содержание: Сапиенс")).toBe(true);
    expect(isDerivative("Sapiens")).toBe(false);
    expect(isDerivative("A Summer of Drowning")).toBe(false);
  });
});

describe("mergeDuplicates", () => {
  it("объединяет две записи одного произведения, оставляя более полную", () => {
    const merged = mergeDuplicates(sapiens());
    expect(merged.map((item) => item.workId)).toEqual([
      "OL17075811W",
      "OL20000001W",
      "OL20000003W",
    ]);
  });

  it("не объединяет одноимённые книги разных авторов", () => {
    const merged = mergeDuplicates(
      parseSearchResponse(fixture("search-gift.json")).candidates,
    );
    expect(merged).toHaveLength(3);
  });

  it("берёт запись с большим числом изданий и сохраняет обложку", () => {
    const merged = mergeDuplicates([
      book({
        workId: "OL1W",
        title: "Дюна",
        authors: ["Frank Herbert"],
        editionCount: 2,
        coverUrl: "c",
      }),
      book({
        workId: "OL2W",
        title: "ДЮНА",
        authors: ["Herbert, Frank"],
        editionCount: 90,
      }),
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].workId).toBe("OL2W");
    expect(merged[0].coverUrl).toBe("c");
  });
});

describe("rankCandidates", () => {
  it("оригинал выше пересказа, даже если каталог поставил пересказ первым", () => {
    const [original, summary, , graphic] = sapiens();
    const ranked = rankCandidates([summary, graphic, original], "sapiens harari");
    expect(ranked[0].workId).toBe("OL17075811W");
    expect(ranked.at(-1)?.workId).toBe("OL20000001W");
  });

  it("если пользователь сам ищет пересказ, он не штрафуется", () => {
    const [original, summary] = sapiens();
    const ranked = rankCandidates([original, summary], "summary of sapiens");
    expect(ranked[0].workId).toBe("OL20000001W");
  });

  it("понимает запрос кириллицей к записи на латинице", () => {
    const ranked = rankCandidates(mergeDuplicates(sapiens()), "Сапиенс Харари");
    expect(ranked[0].workId).toBe("OL17075811W");
    expect(ranked[0].score).toBeGreaterThan(0.75);
  });

  it("автор в запросе выбирает нужную из одноимённых книг", () => {
    const gifts = parseSearchResponse(fixture("search-gift.json")).candidates;
    expect(rankCandidates(gifts, "the gift hyde")[0].authors).toEqual(["Lewis Hyde"]);
    expect(rankCandidates(gifts, "the gift mauss")[0].authors).toEqual(["Marcel Mauss"]);
    expect(rankCandidates(gifts, "Дар Набоков")[0].authors).toEqual(["Vladimir Nabokov"]);
  });

  it("оценка лежит в пределах 0–1", () => {
    for (const item of rankCandidates(sapiens(), "sapiens")) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(1);
    }
  });
});

describe("assessConfidence", () => {
  it("high — один результат явно лучше остальных", () => {
    const ranked = rankCandidates(mergeDuplicates(sapiens()), "sapiens harari");
    expect(assessConfidence(ranked)).toBe("high");
  });

  it("не high для одноимённых книг без автора в запросе", () => {
    const gifts = parseSearchResponse(fixture("search-gift.json")).candidates;
    expect(assessConfidence(rankCandidates(gifts, "the gift"))).not.toBe("high");
  });

  it("low — когда результатов нет или они не похожи на запрос", () => {
    expect(assessConfidence([])).toBe("low");
    const ranked = rankCandidates(
      [
        book({ title: "Совсем другая книга", editionCount: 1 }),
        book({ workId: "OL2W", title: "И эта тоже" }),
      ],
      "sapiens harari",
    );
    expect(assessConfidence(ranked)).toBe("low");
  });
});

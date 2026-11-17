// @vitest-environment node
import { describe, expect, it } from "vitest";
import { findLibraryEntry, LIBRARY, libraryEntry } from "@/library";
import { validateAnalysis } from "@/library/validate";

describe("библиотека готовых анализов", () => {
  for (const entry of LIBRARY) {
    describe(entry.slug, () => {
      it("проходит проверку: схема, ссылки, происхождение, все разделы", () => {
        expect(validateAnalysis(entry.data).join("\n")).toBe("");
      });

      it("соответствует структуре ТЗ: 5–10 идей, 10 инсайтов, 10 выводов, 6 оценок", () => {
        const slides = entry.data.slides;
        const items = (section: string) =>
          slides
            .filter((slide) => slide.section === section)
            .flatMap((slide) => slide.blocks.filter((block) => block.kind === "item"));
        expect(items("ideas").length).toBeGreaterThanOrEqual(5);
        expect(items("ideas").length).toBeLessThanOrEqual(10);
        expect(items("insights")).toHaveLength(10);
        const takeaways = slides.find((slide) => slide.section === "takeaways")!;
        expect(
          takeaways.blocks.filter((block) => block.group?.startsWith("10 выводов")),
        ).toHaveLength(10);
        const scores = slides.find((slide) => slide.section === "scores")!;
        expect(scores.blocks.filter((block) => block.kind === "score")).toHaveLength(6);
        const plan = slides.find((slide) => slide.section === "plan")!;
        expect(new Set(plan.blocks.map((block) => block.group))).toEqual(
          new Set(["Первые 24 часа", "Первые 7 дней", "Первые 30 дней"]),
        );
      });

      it("у каждого факта источник с выдержкой; выдержки короткие — это пересказ, а не текст книги", () => {
        for (const claim of Object.values(entry.data.claims)) {
          if (claim.type === "book_fact" || claim.type === "external_research") {
            expect(claim.evidence.length, claim.id).toBeGreaterThan(0);
          }
          expect(claim.quote, claim.id).toBeNull();
        }
        for (const source of entry.data.sources) {
          for (const excerpt of source.excerpts) {
            expect(excerpt.text.length, excerpt.id).toBeLessThan(450);
          }
        }
        expect(entry.data.editorial?.method).toMatch(/пересказ/);
      });
    });
  }

  it("находит анализ по книге из каталога на английском и по-русски", () => {
    expect(
      findLibraryEntry({ title: "Leadership", authors: ["Henry Kissinger"] })?.slug,
    ).toBe("kissinger-leadership");
    expect(
      findLibraryEntry({
        title: "Leadership: Six Studies in World Strategy",
        authors: ["Kissinger, Henry"],
      })?.slug,
    ).toBe("kissinger-leadership");
    expect(
      findLibraryEntry({ title: "Лидерство", authors: ["Генри Киссинджер"] })?.slug,
    ).toBe("kissinger-leadership");
    expect(
      findLibraryEntry({ title: "Leadership", authors: ["John Maxwell"] }),
    ).toBeUndefined();
    expect(
      findLibraryEntry({ title: "Diplomacy", authors: ["Henry Kissinger"] }),
    ).toBeUndefined();
    expect(libraryEntry("nope")).toBeUndefined();
  });
});

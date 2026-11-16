import { describe, expect, it } from "vitest";
import { normalizeAuthorName, normalizeAuthors } from "@/books/authors";
import { languageName } from "@/books/languages";
import {
  coverage,
  editDistance,
  hasCyrillic,
  normalizeText,
  tokenize,
  tokensMatch,
  transliterate,
} from "@/books/text";

describe("normalizeText", () => {
  it("убирает регистр, диакритику и пунктуацию", () => {
    expect(normalizeText("  «Les Misérables»: Tome 1! ")).toBe("les miserables tome 1");
  });

  it("сводит ё к е и й к и", () => {
    expect(normalizeText("Ёжик и Чёрный Йог")).toBe(normalizeText("ежик и черныи иог"));
  });
});

describe("tokenize", () => {
  it("отбрасывает служебные слова", () => {
    expect(tokenize("The Lord of the Rings")).toEqual(["lord", "rings"]);
    expect(tokenize("Мастер и Маргарита")).toEqual(["мастер", "маргарита"]);
  });

  it("не оставляет пустой список, если все слова служебные", () => {
    expect(tokenize("The A")).toEqual(["the", "a"]);
  });
});

describe("editDistance", () => {
  it.each([
    ["sapiens", "sapiens", 0],
    ["sapiens", "sapeins", 1], // перестановка соседних букв — одна опечатка
    ["harari", "harrari", 1],
    ["kitten", "sitting", 3],
  ])("%s ↔ %s = %i", (a, b, expected) => {
    expect(editDistance(a, b, 5)).toBe(expected);
  });

  it("прекращает счёт, когда расстояние заведомо больше предела", () => {
    expect(editDistance("abcdefgh", "zyxwvuts", 2)).toBe(3);
    expect(editDistance("a", "abcdef", 2)).toBe(3);
  });
});

describe("tokensMatch", () => {
  it("прощает одну опечатку в слове от четырёх букв и две — от восьми", () => {
    expect(tokensMatch("sapeins", "sapiens")).toBe(true);
    expect(tokensMatch("philosofers", "philosophers")).toBe(true);
    expect(tokensMatch("cat", "car")).toBe(false);
    expect(tokensMatch("dune", "done")).toBe(true);
    expect(tokensMatch("sapiens", "savages")).toBe(false);
  });

  it("сопоставляет кириллицу с латиницей", () => {
    expect(hasCyrillic("Харари")).toBe(true);
    expect(transliterate("сапиенс")).toBe("sapiens");
    expect(tokensMatch("харари", "harari")).toBe(true);
    expect(tokensMatch("сапиенс", "sapiens")).toBe(true);
    expect(tokensMatch("булгаков", "bulgakov")).toBe(true);
    expect(tokensMatch("толстои", "tolstoy")).toBe(true);
    expect(tokensMatch("харари", "rowling")).toBe(false);
  });
});

describe("coverage", () => {
  it("считает долю найденных слов", () => {
    expect(coverage(["sapiens", "harari"], ["sapiens", "yuval", "noah", "harari"])).toBe(
      1,
    );
    expect(coverage(["sapiens", "tolkien"], ["sapiens", "harari"])).toBe(0.5);
    expect(coverage([], ["a"])).toBe(0);
  });
});

describe("normalizeAuthorName", () => {
  it.each([
    ["Harari, Yuval Noah", "Yuval Noah Harari"],
    ["Tolstoy, Leo, 1828-1910", "Leo Tolstoy"],
    ["Mauss, Marcel, 1872-1950", "Marcel Mauss"],
    ["J. K. Rowling", "J. K. Rowling"],
    ["  Михаил   Булгаков ", "Михаил Булгаков"],
    ["Rowling, J. K.", "J. K. Rowling"],
    ["Plato (philosopher)", "Plato"],
    ["Orwell, George, 1903-", "George Orwell"],
  ])("%s → %s", (raw, expected) => {
    expect(normalizeAuthorName(raw)).toBe(expected);
  });
});

describe("normalizeAuthors", () => {
  it("убирает повторы одного человека, записанного по-разному", () => {
    expect(
      normalizeAuthors(["Yuval Noah Harari", "Harari, Yuval Noah", "HARARI, YUVAL NOAH"]),
    ).toEqual(["Yuval Noah Harari"]);
  });

  it("ограничивает число авторов и пропускает пустые", () => {
    expect(normalizeAuthors(["A B", " ", "C D", "E F"], 2)).toEqual(["A B", "C D"]);
  });
});

describe("languageName", () => {
  it("знает частые языки и возвращает код для остальных", () => {
    expect(languageName("rus")).toBe("русский");
    expect(languageName("xyz")).toBe("xyz");
  });
});

import { describe, expect, it } from "vitest";
import { MAX_QUERY_LENGTH, normalizeQuery } from "@/books/query";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";

describe("normalizeQuery", () => {
  it("убирает лишние пробелы и переносы строк", () => {
    expect(normalizeQuery("  Сапиенс \n  Харари\t")).toBe("Сапиенс Харари");
  });

  it("пустой, отсутствующий и состоящий из пробелов запрос — пустая строка", () => {
    expect(normalizeQuery(undefined)).toBe("");
    expect(normalizeQuery("")).toBe("");
    expect(normalizeQuery("   ")).toBe("");
    expect(normalizeQuery([])).toBe("");
  });

  it("из повторяющегося параметра берёт первое значение", () => {
    expect(normalizeQuery(["Дюна", "Сапиенс"])).toBe("Дюна");
  });

  it("обрезает слишком длинный запрос", () => {
    const result = normalizeQuery(
      `${"а".repeat(MAX_QUERY_LENGTH - 1)} ${"б".repeat(50)}`,
    );
    expect(result.length).toBeLessThanOrEqual(MAX_QUERY_LENGTH);
    expect(result.endsWith(" ")).toBe(false);
  });
});

describe("plural", () => {
  it.each([
    [1, "издание"],
    [2, "издания"],
    [5, "изданий"],
    [11, "изданий"],
    [21, "издание"],
    [104, "издания"],
    [0, "изданий"],
  ])("%i → %s", (count, expected) => {
    expect(plural(count, "издание", "издания", "изданий")).toBe(expected);
  });
});

describe("cn", () => {
  it("пропускает пустые значения", () => {
    expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

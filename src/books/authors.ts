import { normalizeText } from "@/books/text";

/**
 * Имя автора в естественном порядке:
 * «Harari, Yuval Noah» → «Yuval Noah Harari», «Tolstoy, Leo, 1828-1910» → «Leo Tolstoy».
 */
export function normalizeAuthorName(raw: string): string {
  const cleaned = raw
    .replace(/\(.*?\)/g, " ")
    .replace(/\b\d{3,4}\s*[-–—]\s*(\d{3,4})?(?!\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;\s]+$/, "");

  const parts = cleaned
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  // «Фамилия, Имя» переворачиваем; три части и больше — это уже не одно имя, оставляем как есть.
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return parts.join(", ");
}

/** Список авторов без повторов (один человек часто записан в каталоге несколькими способами). */
export function normalizeAuthors(raw: readonly string[], limit = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of raw) {
    const normalized = normalizeAuthorName(name);
    if (!normalized) continue;
    const key = normalizeText(normalized).split(" ").sort().join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

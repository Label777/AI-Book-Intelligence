/** Работа с текстом для программных проверок: нормализация и похожесть. */

/**
 * Приводит текст к виду для сравнения: регистр, «ё», виды кавычек и тире, пробелы.
 * Знаки препинания сохраняются — цитата должна совпадать с источником дословно.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»“”„‟"]/g, '"')
    .replace(/[‘’‚‛']/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Только буквы и цифры — для сравнения по смыслу, без пунктуации. */
export function normalizeLoose(text: string): string {
  return normalizeForMatch(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function trigrams(text: string): Map<string, number> {
  const padded = ` ${normalizeLoose(text)} `;
  const grams = new Map<string, number>();
  for (let i = 0; i + 3 <= padded.length; i++) {
    const gram = padded.slice(i, i + 3);
    grams.set(gram, (grams.get(gram) ?? 0) + 1);
  }
  return grams;
}

/**
 * Похожесть двух текстов от 0 до 1 — коэффициент Дайса по триграммам символов.
 * Триграммы устойчивы к окончаниям слов, что важно для русского языка.
 */
export function similarity(a: string, b: string): number {
  const ga = trigrams(a);
  const gb = trigrams(b);
  let total = 0;
  let shared = 0;
  for (const count of ga.values()) total += count;
  for (const count of gb.values()) total += count;
  if (total === 0) return 0;
  for (const [gram, count] of ga) {
    shared += Math.min(count, gb.get(gram) ?? 0);
  }
  return (2 * shared) / total;
}

export function wordCount(text: string): number {
  const normalized = normalizeLoose(text);
  return normalized ? normalized.split(" ").length : 0;
}

/** Домен без www из адреса; null, если адрес не разобрать. */
export function domainOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/** Обрезает текст по границе слова, не длиннее `max` символов. */
export function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

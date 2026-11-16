/**
 * Приведение текста к виду для сравнения: нижний регистр, без диакритики и пунктуации.
 * «ё» и «й» сводятся к «е» и «и» — в запросах их часто заменяют.
 */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const STOP_WORDS = new Set(["the", "a", "an", "of", "and", "и", "в", "на", "о"]);

/** Значимые слова текста. Если после отбрасывания служебных слов ничего не осталось, они возвращаются. */
export function tokenize(value: string): string[] {
  const all = normalizeText(value).split(" ").filter(Boolean);
  const meaningful = all.filter((token) => !STOP_WORDS.has(token));
  return meaningful.length > 0 ? meaningful : all;
}

export function hasCyrillic(value: string): boolean {
  return /\p{Script=Cyrillic}/u.test(value);
}

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ж: "zh",
  з: "z",
  и: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  і: "i",
  ї: "yi",
  є: "ye",
  ґ: "g",
};

/** Кириллица → латиница (для сравнения имён и названий, записанных в разных алфавитах). */
export function transliterate(value: string): string {
  let result = "";
  for (const char of value) result += TRANSLIT[char] ?? char;
  return result;
}

/**
 * Варианты слова для сравнения: как есть и в латинице.
 * «х» передают и как kh, и как h (Харари → Harari), поэтому вариантов два.
 */
export function tokenForms(token: string): string[] {
  if (!hasCyrillic(token)) return [token];
  const latin = transliterate(token);
  const forms = new Set([token, latin, latin.replaceAll("kh", "h")]);
  return [...forms];
}

/** Расстояние Дамерау — Левенштейна с ранним выходом: больше max — возвращает max + 1. */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous2: number[] = [];
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previous2[j - 2] + 1);
      }
      current.push(value);
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    previous2 = previous;
    previous = current;
  }
  return previous[b.length];
}

/** Сколько опечаток прощаем слову такой длины. */
function tolerance(length: number): number {
  if (length < 4) return 0;
  return length < 8 ? 1 : 2;
}

/** Совпадают ли два слова с учётом опечаток и разных алфавитов. */
export function tokensMatch(a: string, b: string): boolean {
  for (const formA of tokenForms(a)) {
    for (const formB of tokenForms(b)) {
      if (formA === formB) return true;
      const allowed = tolerance(Math.min(formA.length, formB.length));
      if (allowed > 0 && editDistance(formA, formB, allowed) <= allowed) return true;
    }
  }
  return false;
}

/** Доля слов из needles, для которых нашлось совпадение в haystack (0–1). */
export function coverage(needles: string[], haystack: string[]): number {
  if (needles.length === 0) return 0;
  let found = 0;
  for (const needle of needles) {
    if (haystack.some((candidate) => tokensMatch(needle, candidate))) found += 1;
  }
  return found / needles.length;
}

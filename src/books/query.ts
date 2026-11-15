export const MAX_QUERY_LENGTH = 200;

/**
 * Приводит поисковый запрос из адресной строки к каноническому виду:
 * одна строка, без лишних пробелов, ограниченной длины. Пустой запрос — "".
 */
export function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH).trim();
}

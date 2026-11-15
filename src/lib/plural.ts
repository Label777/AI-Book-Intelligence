const rules = new Intl.PluralRules("ru-RU");

/**
 * Русская форма слова по числу: plural(3, "издание", "издания", "изданий") → "издания".
 */
export function plural(count: number, one: string, few: string, many: string): string {
  switch (rules.select(count)) {
    case "one":
      return one;
    case "few":
      return few;
    default:
      return many;
  }
}

import type { PresentationData } from "@/analysis/types";
import { isSameBook } from "@/books/libraries";
import { kissingerLeadership } from "@/library/analyses/kissinger-leadership";

/** Готовый анализ из библиотеки сайта. */
export interface LibraryEntry {
  slug: string;
  /** Названия и авторы книги на других языках — чтобы узнать её в каталоге. */
  aliases: { title: string; authors: string[] }[];
  data: PresentationData;
}

export const LIBRARY: LibraryEntry[] = [
  {
    slug: "kissinger-leadership",
    aliases: [
      {
        title: "Leadership: Six Studies in World Strategy",
        authors: ["Henry Kissinger"],
      },
      { title: "Лидерство", authors: ["Генри Киссинджер"] },
    ],
    data: kissingerLeadership,
  },
];

export function libraryEntry(slug: string): LibraryEntry | undefined {
  return LIBRARY.find((entry) => entry.slug === slug);
}

export function libraryHref(slug: string): string {
  return `/library/${slug}`;
}

/** Готовый анализ для книги из каталога: совпадение по названию и автору на любом из языков. */
export function findLibraryEntry(book: {
  title: string;
  authors: string[];
}): LibraryEntry | undefined {
  return LIBRARY.find((entry) =>
    entry.aliases.some((alias) =>
      isSameBook(
        // Сравниваем основное название — без подзаголовка после двоеточия или точки.
        { workId: "", title: alias.title.split(/[:.]/)[0], authors: alias.authors },
        book.title,
        book.authors,
      ),
    ),
  );
}

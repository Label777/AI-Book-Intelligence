import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { findLibraryEntry, libraryHref } from "@/library";

/** На странице книги: если для неё есть готовый анализ — ссылка на него. */
export function LibraryLink({ book }: { book: { title: string; authors: string[] } }) {
  const entry = findLibraryEntry(book);
  if (!entry) return null;
  return (
    <div className="mt-4 flex flex-col items-start gap-3 rounded-control border border-accent p-4">
      <p className="font-medium">Готовый анализ этой книги уже есть</p>
      <Link href={libraryHref(entry.slug)} className={buttonClasses("primary", "md")}>
        Открыть анализ
      </Link>
    </div>
  );
}

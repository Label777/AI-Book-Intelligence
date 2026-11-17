import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Presentation } from "@/components/presentation/presentation";
import { LIBRARY, libraryEntry } from "@/library";
import { searchHref } from "@/lib/routes";

// Готовые анализы собираются при сборке: работают и на сервере, и в статической версии сайта.

export function generateStaticParams() {
  return LIBRARY.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const entry = libraryEntry((await params).slug);
  if (!entry) return { title: "Анализ не найден" };
  const { book } = entry.data;
  return {
    title: `${book.title} — анализ книги`,
    description: `Анализ книги «${book.title}» (${book.authors.join(", ")}): идеи, разбор глав, критика и план внедрения. У каждого утверждения — источник.`,
  };
}

export default async function LibraryAnalysisPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const entry = libraryEntry((await params).slug);
  if (!entry) notFound();
  // Книга ведёт к поиску по оригинальному названию: так её найдёт каталог.
  const original = entry.aliases[0];
  const backHref = searchHref(`${original.title.split(":")[0]} ${original.authors[0]}`);
  return <Presentation data={entry.data} backHref={backHref} />;
}

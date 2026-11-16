import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { normalizeQuery } from "@/books/query";
import { searchBooks } from "@/books/search";
import { CatalogError, type SearchOutcome } from "@/books/types";
import { SearchForm } from "@/components/search-form";
import { Results, SearchFailed } from "@/components/search-results";
import { BookCardSkeleton, Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Поиск книги",
  robots: { index: false },
};

async function SearchContent({
  searchParams,
}: Pick<PageProps<"/search">, "searchParams">) {
  const params = await searchParams;
  // Кэш и очередь запросов к каталогу читают текущее время — это работа времени запроса.
  await connection();
  const query = normalizeQuery(params.q);

  let outcome: SearchOutcome | null = null;
  let failed = false;
  if (query) {
    try {
      outcome = await searchBooks(query);
    } catch (error) {
      if (!(error instanceof CatalogError)) throw error;
      failed = true;
    }
  }

  return (
    <>
      {/* key: при новом запросе поле показывает именно его, а не прежний ввод */}
      <SearchForm key={query} defaultValue={query} />
      <div role="status" className="mt-10 flex flex-col gap-6">
        {failed ? (
          <SearchFailed query={query} />
        ) : outcome ? (
          <Results outcome={outcome} />
        ) : (
          <p className="text-ink-2">
            Введите название книги и автора, чтобы начать поиск.
          </p>
        )}
      </div>
    </>
  );
}

function SearchFallback() {
  return (
    <div role="status">
      <span className="sr-only">Ищем книгу…</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-14 w-full" />
        </div>
        <Skeleton className="h-14 w-full sm:w-44" />
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <BookCardSkeleton />
        <BookCardSkeleton />
        <BookCardSkeleton />
        <BookCardSkeleton />
      </div>
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <h1 className="text-title">Поиск книги</h1>
      <div className="mt-8">
        <Suspense fallback={<SearchFallback />}>
          <SearchContent searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:no-underline"
        >
          ← На главную
        </Link>
      </p>
    </div>
  );
}

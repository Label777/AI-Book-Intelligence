"use client";

import { useSearchParams } from "next/navigation";
import { normalizeQuery } from "@/books/query";
import { searchBooks } from "@/books/search";
import { CatalogError } from "@/books/types";
import { SearchForm } from "@/components/search-form";
import { Results, SearchFailed } from "@/components/search-results";
import { useAsync } from "@/components/static/use-async";
import { BookCardSkeleton } from "@/components/ui/skeleton";

/** Поиск в статической сборке: браузер сам обращается к каталогу. */
export function SearchClient() {
  const query = normalizeQuery(useSearchParams().get("q") ?? undefined);
  const state = useAsync(query, () => searchBooks(query));

  return (
    <>
      <SearchForm key={query} defaultValue={query} />
      <div role="status" className="mt-10 flex flex-col gap-6">
        {!state ? (
          <p className="text-ink-2">
            Введите название книги и автора, чтобы начать поиск.
          </p>
        ) : state.status === "loading" ? (
          <>
            <span className="sr-only">Ищем книгу…</span>
            <div className="grid gap-4 md:grid-cols-2">
              <BookCardSkeleton />
              <BookCardSkeleton />
              <BookCardSkeleton />
              <BookCardSkeleton />
            </div>
          </>
        ) : state.status === "done" ? (
          <Results outcome={state.value} />
        ) : state.error instanceof CatalogError ? (
          <SearchFailed query={query} />
        ) : (
          <p className="text-src-critique">
            Не удалось выполнить поиск. Обновите страницу.
          </p>
        )}
      </div>
    </>
  );
}

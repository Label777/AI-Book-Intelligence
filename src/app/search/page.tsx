import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { normalizeQuery } from "@/books/query";
import { SearchForm } from "@/components/search-form";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Поиск книги",
  robots: { index: false },
};

async function SearchContent({
  searchParams,
}: Pick<PageProps<"/search">, "searchParams">) {
  const query = normalizeQuery((await searchParams).q);

  return (
    <>
      {/* key: при новом запросе поле показывает именно его, а не прежний ввод */}
      <SearchForm key={query} defaultValue={query} />
      <div role="status" className="mt-10 flex flex-col gap-4">
        {query ? (
          <>
            <p className="text-lg">
              Запрос: <strong className="font-semibold break-words">«{query}»</strong>
            </p>
            <div className="rounded-card border border-line bg-surface p-6">
              <p className="font-medium text-ink">Каталог книг ещё не подключён</p>
              <p className="mt-2 max-w-[70ch] text-ink-2">
                Поиск изданий по названию и автору появится на следующем этапе разработки.
                Здесь будут карточки найденных книг — с обложкой, годом первой публикации
                и выбором издания.
              </p>
            </div>
          </>
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
      <span className="sr-only">Загрузка…</span>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-14 w-full" />
        </div>
        <Skeleton className="h-14 w-full sm:w-44" />
      </div>
      <SkeletonText lines={3} className="mt-10 max-w-xl" />
    </div>
  );
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
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

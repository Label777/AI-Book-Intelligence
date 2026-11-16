import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { normalizeQuery } from "@/books/query";
import { searchBooks } from "@/books/search";
import { CatalogError, type SearchOutcome } from "@/books/types";
import { SearchForm } from "@/components/search-form";
import { BookCard } from "@/components/ui/book-card";
import { buttonClasses } from "@/components/ui/button";
import { BookCardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { plural } from "@/lib/plural";

export const metadata: Metadata = {
  title: "Поиск книги",
  robots: { index: false },
};

function bookHref(workId: string, query: string): string {
  return `/book/${workId}?${new URLSearchParams({ q: query })}`;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-6">
      <p className="font-medium text-ink">{title}</p>
      <div className="mt-2 max-w-[70ch] text-ink-2">{children}</div>
    </div>
  );
}

function Results({ outcome }: { outcome: SearchOutcome }) {
  const { query, candidates, strategy, correctedQuery, confidence } = outcome;

  if (candidates.length === 0) {
    return (
      <Notice title={`По запросу «${query}» ничего не найдено`}>
        <ul className="list-disc space-y-1 pl-5">
          <li>Проверьте написание названия и фамилии автора.</li>
          <li>Добавьте автора, если искали только по названию.</li>
          <li>Попробуйте название на языке оригинала.</li>
        </ul>
      </Notice>
    );
  }

  const count = candidates.length;
  // Уверенное совпадение показываем отдельно и крупно, остальные — ниже.
  const top = confidence === "high" ? candidates[0] : undefined;
  const rest = top ? candidates.slice(1) : candidates;

  return (
    <>
      <p className="text-ink-2">
        {strategy === "corrected" && correctedQuery ? (
          <>
            Точного совпадения с «{query}» нет. Показаны результаты по запросу{" "}
            <strong className="font-semibold text-ink">«{correctedQuery}»</strong>.
          </>
        ) : strategy === "fuzzy" ? (
          <>Точного совпадения с «{query}» нет. Показаны книги с похожими названиями.</>
        ) : top ? (
          <>Скорее всего, вы ищете эту книгу.</>
        ) : confidence === "low" ? (
          <>
            Мы не уверены, какую книгу вы ищете. Выберите подходящую или уточните запрос.
          </>
        ) : (
          <>
            {plural(count, "Найдена", "Найдены", "Найдено")} {count}{" "}
            {plural(count, "книга", "книги", "книг")} по запросу «{query}». Выберите
            нужную.
          </>
        )}
      </p>
      {top ? (
        <div className="flex flex-col gap-4 rounded-card border border-accent p-4 sm:flex-row sm:items-center">
          <BookCard
            className="flex-1 border-transparent bg-transparent p-0 shadow-none hover:border-transparent"
            title={top.title}
            authors={top.authors}
            year={top.firstPublishYear}
            editionCount={top.editionCount}
            coverUrl={top.coverUrl}
            href={bookHref(top.workId, query)}
            headingLevel="h2"
          />
          <Link
            href={bookHref(top.workId, query)}
            className={buttonClasses("primary", "md")}
          >
            Да, это она
          </Link>
        </div>
      ) : null}
      {rest.length > 0 ? (
        <>
          {top ? <h2 className="text-heading">Другие результаты</h2> : null}
          <ul className="grid gap-4 md:grid-cols-2">
            {rest.map((book) => (
              <li key={book.workId}>
                <BookCard
                  className="h-full"
                  title={book.title}
                  authors={book.authors}
                  year={book.firstPublishYear}
                  editionCount={book.editionCount}
                  coverUrl={book.coverUrl}
                  href={bookHref(book.workId, query)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-sm text-ink-2">
        Данные о книгах —{" "}
        <a
          href="https://openlibrary.org"
          rel="noreferrer"
          className="underline underline-offset-4 hover:no-underline"
        >
          Open Library
        </a>
        .
      </p>
    </>
  );
}

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
          <Notice title="Каталог книг сейчас не отвечает">
            <p>
              Это временная неполадка на стороне Open Library. Попробуйте ещё раз через
              минуту.
            </p>
            <p className="mt-3">
              <Link
                href={`/search?${new URLSearchParams({ q: query })}`}
                className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:no-underline"
              >
                Повторить поиск
              </Link>
            </p>
          </Notice>
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

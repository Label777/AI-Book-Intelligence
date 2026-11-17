"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { normalizeQuery } from "@/books/query";
import { CatalogError } from "@/books/types";
import { getBook, isEditionId, isWorkId } from "@/books/work";
import {
  BookView,
  CatalogDown,
  linkClass,
  selectedEditionTitle,
} from "@/components/book-view";
import { LibraryLink } from "@/components/library-link";
import { useAsync } from "@/components/use-async";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { bookHref, type BookPageState } from "@/lib/routes";

function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-label text-accent">404</p>
      <h1 className="text-title">Книга не найдена</h1>
      <p className="max-w-[60ch] text-ink-2">
        Возможно, ссылка устарела или в адресе опечатка.
      </p>
      <Link href="/" className={linkClass}>
        ← К поиску
      </Link>
    </div>
  );
}

/** Страница книги в статической сборке: адрес вида /book/?id=OL17075811W. */
export function BookClient() {
  const params = useSearchParams();
  const id = params.get("id") ?? "";
  const workId = isWorkId(id) ? id : "";
  const state: BookPageState = {
    q: normalizeQuery(params.get("q") ?? undefined),
    lang: /^[a-z]{3}$/.test(params.get("lang") ?? "")
      ? (params.get("lang") ?? undefined)
      : undefined,
    edition: isEditionId(params.get("edition") ?? "")
      ? (params.get("edition") ?? undefined)
      : undefined,
  };
  const result = useAsync(workId, () => getBook(workId));

  if (!result) return <NotFound />;
  if (result.status === "loading") {
    return (
      <div role="status">
        <span className="sr-only">Загружаем сведения о книге…</span>
        <Skeleton className="h-5 w-56" />
        <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:gap-8">
          <Skeleton className="aspect-[2/3] w-36 sm:w-44" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-5 w-1/2" />
            <SkeletonText lines={4} className="mt-4 max-w-xl" />
          </div>
        </div>
      </div>
    );
  }
  if (result.status === "error") {
    if (result.error instanceof CatalogError) {
      return <CatalogDown retryHref={bookHref(workId, state)} />;
    }
    return (
      <p className="text-src-critique">Не удалось загрузить книгу. Обновите страницу.</p>
    );
  }
  const book = result.value;
  if (!book) return <NotFound />;

  // Выбранное издание учитываем, только если оно действительно относится к этой книге.
  const selected = book.editions.find((edition) => edition.id === state.edition);
  const checked = { ...state, edition: selected?.id };

  return (
    <BookView book={book} state={checked}>
      <section
        aria-labelledby="next-title"
        className="mt-12 rounded-card border border-line bg-surface p-6"
      >
        <h2 id="next-title" className="font-medium text-ink">
          {selectedEditionTitle(selected)}
        </h2>
        <LibraryLink book={book} />
        <p className="mt-2 max-w-[70ch] text-ink-2">
          В этой версии сайта можно найти книгу и выбрать издание. Создание анализа здесь
          недоступно: для него нужен сервер с доступом к AI-модели.
        </p>
        <p className="mt-3">
          <a
            href={`https://openlibrary.org/works/${book.workId}`}
            rel="noreferrer"
            className={linkClass}
          >
            Открыть запись в Open Library
          </a>
        </p>
      </section>
    </BookView>
  );
}

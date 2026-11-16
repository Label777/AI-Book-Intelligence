import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { analysisIdFor, getAnalysisService } from "@/analysis/service";
import { startAnalysisAction } from "@/app/analysis/actions";
import { normalizeQuery } from "@/books/query";
import { CatalogError, type BookDetails } from "@/books/types";
import { getBook, isEditionId, isWorkId } from "@/books/work";
import { BookView, CatalogDown } from "@/components/book-view";
import { Button, buttonClasses } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { bookHref, type BookPageState } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Подтверждение книги",
  robots: { index: false },
};

const linkClass =
  "inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:no-underline";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const LAUNCH_ERRORS: Record<string, string> = {
  busy: "Сейчас создаётся слишком много анализов. Попробуйте через несколько минут.",
  catalog: "Каталог книг не ответил, анализ не запущен. Попробуйте ещё раз.",
  "no-author": "У книги не указан автор — анализ для неё недоступен.",
};

async function BookContent({ params, searchParams }: PageProps<"/book/[workId]">) {
  const [{ workId }, query] = await Promise.all([params, searchParams]);
  // Кэш и очередь запросов к каталогу читают текущее время — это работа времени запроса.
  await connection();
  if (!isWorkId(workId)) notFound();

  const state: BookPageState = {
    q: normalizeQuery(query.q),
    lang: /^[a-z]{3}$/.test(first(query.lang) ?? "") ? first(query.lang) : undefined,
    edition: isEditionId(first(query.edition) ?? "") ? first(query.edition) : undefined,
  };

  let book: BookDetails | null;
  try {
    book = await getBook(workId);
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    return <CatalogDown retryHref={bookHref(workId, state)} />;
  }
  if (!book) notFound();

  // Выбранное издание учитываем, только если оно действительно относится к этой книге.
  const selected = book.editions.find((edition) => edition.id === state.edition);
  state.edition = selected?.id;

  const analysis = getAnalysisService();
  const existing = await analysis.status(
    analysisIdFor({
      book: {
        workId: book.workId,
        title: book.title,
        authors: book.authors.length > 0 ? book.authors : ["?"],
        firstPublishYear: null,
        description: null,
        subjects: [],
      },
      mode: "sources_only",
      language: "ru",
    }),
  );
  const launchError = LAUNCH_ERRORS[first(query.error) ?? ""];

  return (
    <BookView book={book} state={state}>
      <section
        aria-labelledby="next-title"
        className="mt-12 rounded-card border border-line bg-surface p-6"
      >
        <h2 id="next-title" className="font-medium text-ink">
          {selected
            ? `Выбрано издание: ${selected.title}${selected.year ? `, ${selected.year}` : ""}`
            : "Издание не выбрано"}
        </h2>
        {launchError ? (
          <p role="alert" className="mt-3 text-src-critique">
            {launchError}
          </p>
        ) : null}
        {existing?.phase === "ready" ? (
          <>
            <p className="mt-2 max-w-[70ch] text-ink-2">Анализ этой книги уже готов.</p>
            <p className="mt-4">
              <Link
                href={`/analysis/${existing.meta.id}`}
                className={buttonClasses("primary", "lg")}
              >
                Открыть анализ
              </Link>
            </p>
          </>
        ) : existing?.phase === "running" ? (
          <>
            <p className="mt-2 max-w-[70ch] text-ink-2">
              Анализ этой книги создаётся прямо сейчас.
            </p>
            <p className="mt-4">
              <Link
                href={`/analysis/${existing.meta.id}`}
                className={buttonClasses("primary", "lg")}
              >
                Смотреть ход работы
              </Link>
            </p>
          </>
        ) : book.authors.length === 0 ? (
          <p className="mt-2 max-w-[70ch] text-ink-2">
            В каталоге у этой книги не указан автор, а без него нельзя надёжно искать
            источники. Анализ для неё пока недоступен.
          </p>
        ) : analysis.available ? (
          <>
            <p className="mt-2 max-w-[70ch] text-ink-2">
              Анализ строится по открытым источникам: текста книги у нас нет. Сначала мы
              найдём источники и покажем, чего не хватает; обычно всё занимает несколько
              минут.
            </p>
            <form action={startAnalysisAction} className="mt-4">
              <input type="hidden" name="workId" value={book.workId} />
              <Button type="submit" size="lg">
                Создать анализ
              </Button>
            </form>
          </>
        ) : (
          <p className="mt-2 max-w-[70ch] text-ink-2">
            Запуск анализа сейчас недоступен: на сервере не задан ключ Claude API.
          </p>
        )}
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

function BookFallback() {
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

export default function BookPage(props: PageProps<"/book/[workId]">) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <Suspense fallback={<BookFallback />}>
        <BookContent {...props} />
      </Suspense>
    </div>
  );
}

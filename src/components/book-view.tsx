import Link from "next/link";
import type { ReactNode } from "react";
import { languageName } from "@/books/languages";
import type { BookDetails, Edition } from "@/books/types";
import { BookCover } from "@/components/ui/book-cover";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";
import { bookHref, searchHref, type BookPageState } from "@/lib/routes";

export const linkClass =
  "inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:no-underline";

type PageState = BookPageState;
const pageHref = bookHref;

const DESCRIPTION_PREVIEW = 600;

/** Делит длинное описание на видимую часть и остаток — по границе предложения или слова. */
function splitDescription(text: string): [string, string] {
  if (text.length <= DESCRIPTION_PREVIEW * 1.3) return [text, ""];
  const head = text.slice(0, DESCRIPTION_PREVIEW);
  const sentenceEnd = Math.max(
    head.lastIndexOf(". "),
    head.lastIndexOf("! "),
    head.lastIndexOf("? "),
    head.lastIndexOf("\n"),
  );
  const cut =
    sentenceEnd > DESCRIPTION_PREVIEW / 2 ? sentenceEnd + 1 : head.lastIndexOf(" ");
  return [text.slice(0, cut).trim(), text.slice(cut).trim()];
}

function editionMeta(edition: Edition): string {
  return [
    edition.languages.map(languageName).join(", "),
    edition.year ? String(edition.year) : null,
    edition.publishers.join(", "),
    edition.pages ? `${edition.pages} с.` : null,
    edition.isbn ? `ISBN ${edition.isbn}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function Editions({ book, state }: { book: BookDetails; state: PageState }) {
  const languages = [...new Set(book.editions.flatMap((edition) => edition.languages))];
  const lang = state.lang && languages.includes(state.lang) ? state.lang : undefined;
  const visible = lang
    ? book.editions.filter((edition) => edition.languages.includes(lang))
    : book.editions;

  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150",
      active
        ? "border-accent bg-accent text-on-accent"
        : "border-line-strong text-ink hover:bg-surface-2",
    );

  return (
    <section aria-labelledby="editions-title" className="mt-12">
      <h2 id="editions-title" className="text-heading">
        Выберите издание
      </h2>
      <p className="mt-2 max-w-[70ch] text-ink-2">
        От издания зависят язык, оглавление и нумерация страниц. Если не важно — оставьте
        без выбора.
      </p>

      {book.editions.length === 0 ? (
        <p className="mt-6 text-ink-2">В каталоге нет сведений об изданиях этой книги.</p>
      ) : (
        <>
          {languages.length > 1 ? (
            <nav aria-label="Язык издания" className="mt-6">
              <ul className="flex flex-wrap gap-2">
                <li>
                  <Link
                    href={pageHref(book.workId, { q: state.q })}
                    scroll={false}
                    aria-current={!lang ? "true" : undefined}
                    className={chip(!lang)}
                  >
                    Все языки
                  </Link>
                </li>
                {languages.map((code) => (
                  <li key={code}>
                    <Link
                      href={pageHref(book.workId, { q: state.q, lang: code })}
                      scroll={false}
                      aria-current={lang === code ? "true" : undefined}
                      className={chip(lang === code)}
                    >
                      {languageName(code)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <ul className="mt-6 flex flex-col gap-3">
            {visible.map((edition) => {
              const selected = edition.id === state.edition;
              return (
                <li key={edition.id}>
                  <Link
                    href={pageHref(book.workId, {
                      q: state.q,
                      lang,
                      edition: selected ? undefined : edition.id,
                    })}
                    scroll={false}
                    aria-current={selected ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-4 rounded-card border bg-surface p-4 transition-colors duration-150",
                      selected ? "border-accent" : "border-line hover:border-line-strong",
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="font-medium wrap-anywhere text-ink">
                        {edition.title}
                        {edition.subtitle ? `. ${edition.subtitle}` : ""}
                      </span>
                      <span className="text-sm wrap-anywhere text-ink-2">
                        {editionMeta(edition) || "Сведений об издании нет"}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 text-label-sm",
                        selected ? "text-accent" : "text-ink-2",
                      )}
                    >
                      {selected ? "Выбрано" : "Выбрать"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {book.editionTotal > book.editions.length ? (
            <p className="mt-4 text-sm text-ink-2">
              Показаны {book.editions.length} из {book.editionTotal}{" "}
              {plural(book.editionTotal, "издания", "изданий", "изданий")}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

export interface BookViewProps {
  book: BookDetails;
  /** Состояние из адреса: запрос, язык, выбранное издание (уже проверенное). */
  state: BookPageState;
  /** Что показать после списка изданий — блок запуска анализа или пояснение. */
  children?: ReactNode;
}

/** Страница подтверждения книги: сведения, описание из каталога, выбор издания. */
export function BookView({ book, state, children }: BookViewProps) {
  const backHref = state.q ? searchHref(state.q) : "/";
  const [descriptionHead, descriptionRest] = book.description
    ? splitDescription(book.description)
    : ["", ""];
  const meta = [
    book.firstPublishYear ? `Первая публикация: ${book.firstPublishYear}` : null,
    book.editionTotal
      ? `${book.editionTotal} ${plural(book.editionTotal, "издание", "издания", "изданий")}`
      : null,
  ].filter(Boolean);

  return (
    <>
      <p>
        <Link href={backHref} className={linkClass}>
          {state.q ? "← Не та книга? Все результаты" : "← К поиску"}
        </Link>
      </p>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:gap-8">
        <BookCover
          title={book.title}
          authors={book.authors}
          coverUrl={book.coverUrl}
          size="lg"
          className="w-36 sm:w-44"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <p className="text-label text-accent">Это та книга?</p>
          <h1 className="text-title wrap-anywhere">{book.title}</h1>
          {book.subtitle ? <p className="text-lg text-ink-2">{book.subtitle}</p> : null}
          {book.authors.length > 0 ? (
            <p className="text-lg">{book.authors.join(", ")}</p>
          ) : null}
          {meta.length > 0 ? (
            <p className="text-label text-ink-2">{meta.join(" · ")}</p>
          ) : null}
          {book.subjects.length > 0 ? (
            <ul aria-label="Темы" className="flex flex-wrap gap-2">
              {book.subjects.map((subject) => (
                <li
                  key={subject}
                  className="rounded-full bg-surface-2 px-3 py-1 text-label-sm text-ink-2"
                >
                  {subject}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {descriptionHead ? (
        <section aria-labelledby="description-title" className="mt-10 max-w-[70ch]">
          <h2 id="description-title" className="text-label text-ink-2">
            Описание из каталога Open Library
          </h2>
          <p className="mt-3 whitespace-pre-line">{descriptionHead}</p>
          {descriptionRest ? (
            <details className="mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer items-center text-accent underline underline-offset-4">
                Показать описание полностью
              </summary>
              <p className="mt-2 whitespace-pre-line">{descriptionRest}</p>
            </details>
          ) : null}
        </section>
      ) : null}

      <Editions book={book} state={state} />

      {children}
    </>
  );
}

/** Каталог не ответил: сообщение и ссылка для повтора. */
export function CatalogDown({ retryHref }: { retryHref: string }) {
  return (
    <div role="status" className="rounded-card border border-line bg-surface p-6">
      <p className="font-medium text-ink">Каталог книг сейчас не отвечает</p>
      <p className="mt-2 max-w-[70ch] text-ink-2">
        Это временная неполадка на стороне Open Library. Попробуйте ещё раз через минуту.
      </p>
      <p className="mt-3">
        <Link href={retryHref} className={linkClass}>
          Обновить страницу
        </Link>
      </p>
    </div>
  );
}

/** Заголовок блока под списком изданий: какое издание выбрано. */
export function selectedEditionTitle(selected: Edition | undefined): string {
  return selected
    ? `Выбрано издание: ${selected.title}${selected.year ? `, ${selected.year}` : ""}`
    : "Издание не выбрано";
}

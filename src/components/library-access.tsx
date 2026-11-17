"use client";

import {
  ACCESS_CHECKS,
  LIBRARIES,
  type AccessKind,
  type BookRef,
} from "@/books/libraries";
import { useAsync } from "@/components/use-async";

const ACTION: Record<AccessKind, string> = {
  read: "Читать бесплатно",
  borrow: "Взять почитать на время",
  preview: "Читать фрагмент",
};

/**
 * «Где читать и слушать»: проверенные ссылки на книгу в открытых библиотеках
 * и поиск этой книги в остальных.
 */
export function LibraryAccess({ book }: { book: BookRef }) {
  const ref: BookRef = { workId: book.workId, title: book.title, authors: book.authors };
  // Каждая библиотека проверяется отдельно: найденное показываем сразу, не дожидаясь медленных.
  const checks = [
    useAsync(book.workId, () => ACCESS_CHECKS.openlibrary(ref)),
    useAsync(book.workId, () => ACCESS_CHECKS.gutenberg(ref)),
    useAsync(book.workId, () => ACCESS_CHECKS.google(ref)),
  ];
  const found = checks.flatMap((check) => (check?.status === "done" ? check.value : []));
  const loading = checks.some((check) => check?.status === "loading");
  const foundIds = new Set(found.map((item) => item.libraryId));

  return (
    <section aria-labelledby="libraries-title" className="mt-12">
      <h2 id="libraries-title" className="text-heading">
        Где читать и слушать
      </h2>
      <p className="mt-2 max-w-[70ch] text-ink-2">
        Только бесплатные легальные библиотеки. Новые книги под авторским правом в них
        обычно доступны фрагментом или на время.
      </p>

      <div role="status" className="mt-6">
        {found.length > 0 ? (
          <ul aria-label="Найдено в библиотеках" className="flex flex-col gap-3">
            {found.map((item) => {
              const library = LIBRARIES.find((entry) => entry.id === item.libraryId);
              if (!library) return null;
              return (
                <li key={`${item.libraryId}-${item.kind}`}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    data-found={item.libraryId}
                    className="flex min-h-11 items-center justify-between gap-4 rounded-card border border-accent bg-surface p-4 transition-colors duration-150 hover:bg-surface-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="font-medium">{ACTION[item.kind]}</span>
                      <span className="text-sm text-ink-2">{library.name}</span>
                    </span>
                    <span aria-hidden="true" className="text-accent">
                      ↗
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : loading ? null : (
          <p className="text-ink-2">
            Готовой бесплатной копии мы не нашли. Попробуйте поиск в библиотеках ниже.
          </p>
        )}
        {loading ? (
          <p className={found.length > 0 ? "mt-3 text-ink-2" : "text-ink-2"}>
            Проверяем наличие в библиотеках…
          </p>
        ) : null}
      </div>

      <h3 className="mt-8 text-label text-accent">Искать эту книгу в библиотеках</h3>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {LIBRARIES.filter((library) => !foundIds.has(library.id)).map((library) => (
          <li key={library.id}>
            <a
              href={library.searchUrl(ref)}
              target="_blank"
              rel="noreferrer"
              data-library={library.id}
              className="flex h-full min-h-11 flex-col justify-center rounded-control border border-line px-4 py-2.5 transition-colors duration-150 hover:border-line-strong"
            >
              <span className="font-medium">
                {library.name} <span aria-hidden="true">↗</span>
              </span>
              <span className="text-sm text-ink-2">{library.about}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

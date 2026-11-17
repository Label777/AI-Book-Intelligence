import { LIBRARIES } from "@/books/libraries";

/** Блок главной: какие открытые библиотеки подключены к сайту. */
export function LibrariesSection() {
  return (
    <section
      id="libraries"
      aria-labelledby="libraries-home-title"
      className="scroll-mt-8 border-t border-line bg-surface"
    >
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <h2 id="libraries-home-title" className="text-title">
          Книги из десяти открытых библиотек
        </h2>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-2">
          На странице каждой книги видно, где её можно бесплатно и легально прочитать или
          послушать. Пиратских библиотек среди источников нет.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIBRARIES.map((library) => (
            <li
              key={library.id}
              className="flex flex-col gap-2 rounded-card border border-line bg-page p-5"
            >
              <span className="text-label-sm text-accent">
                {library.connection === "check"
                  ? "Проверяем наличие книги"
                  : "Поиск книги по ссылке"}
              </span>
              <span className="font-serif text-lg font-semibold">{library.name}</span>
              <span className="text-ink-2">{library.about}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

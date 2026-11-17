import Link from "next/link";
import { LIBRARY, libraryHref } from "@/library";
import { plural } from "@/lib/plural";

/** Блок главной: готовые анализы, которые можно открыть сразу. */
export function LibrarySection() {
  if (LIBRARY.length === 0) return null;
  return (
    <section
      id="examples"
      aria-labelledby="examples-title"
      className="scroll-mt-8 border-t border-line"
    >
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <h2 id="examples-title" className="text-title">
          Готовые анализы
        </h2>
        <p className="mt-4 max-w-[60ch] text-lg text-ink-2">
          Откройте презентацию и нажмите на метку у любого утверждения — увидите, откуда
          оно взято.
        </p>
        <ul className="mt-10 grid gap-4 md:grid-cols-2">
          {LIBRARY.map(({ slug, data }) => (
            <li key={slug}>
              <Link
                href={libraryHref(slug)}
                className="group flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-6 shadow-card transition-colors duration-150 hover:border-line-strong"
              >
                <span className="text-label-sm text-accent">По открытым источникам</span>
                <span className="font-serif text-xl font-semibold group-hover:text-accent">
                  {data.book.title}
                </span>
                <span className="text-ink-2">{data.book.authors.join(", ")}</span>
                <span className="mt-auto pt-2 text-label-sm text-ink-2">
                  {data.slides.length}{" "}
                  {plural(data.slides.length, "слайд", "слайда", "слайдов")} ·{" "}
                  {data.sources.length}{" "}
                  {plural(data.sources.length, "источник", "источника", "источников")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

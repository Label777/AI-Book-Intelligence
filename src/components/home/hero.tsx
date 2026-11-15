import { SearchForm } from "@/components/search-form";
import { ProvenanceLabel } from "@/components/ui/provenance-label";
import type { ProvenanceType } from "@/lib/provenance";

/** Строки схематичного слайда: метка и «текст» разной длины. */
const slideRows: { type: ProvenanceType; lines: string[] }[] = [
  { type: "book_fact", lines: ["w-full", "w-4/5"] },
  { type: "ai_interpretation", lines: ["w-11/12", "w-2/3"] },
  { type: "external_research", lines: ["w-full", "w-1/2"] },
  { type: "critique", lines: ["w-5/6"] },
];

/** Схема слайда: показывает, что у каждого утверждения есть метка. Декоративная. */
function SlideSketch() {
  return (
    <div
      aria-hidden="true"
      className="rounded-slide border border-line bg-surface p-5 shadow-card sm:p-7"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-label-sm text-ink-2">03 / 14</span>
        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-label-sm text-ink-2">
          По открытым источникам
        </span>
      </div>
      <div className="mt-6 h-5 w-3/5 rounded-full bg-ink/85" />
      <div className="mt-2.5 h-5 w-2/5 rounded-full bg-ink/85" />
      <ul className="mt-7 flex flex-col gap-5">
        {slideRows.map((row) => (
          <li key={row.type} className="flex flex-col items-start gap-2.5">
            <ProvenanceLabel type={row.type} />
            {row.lines.map((width, index) => (
              <span
                key={index}
                className={`block h-2.5 rounded-full bg-surface-2 ${width}`}
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid max-w-page items-center gap-10 px-4 pt-12 pb-16 sm:px-6 md:pt-16 md:pb-20 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16 lg:px-8 lg:pt-24 lg:pb-28"
    >
      <div className="flex flex-col gap-6">
        <p className="animate-rise text-label text-accent">
          Анализ книг с видимыми источниками
        </p>
        <h1 id="hero-title" className="animate-rise text-display [animation-delay:40ms]">
          Любая книга — как презентация, где у каждой мысли есть источник
        </h1>
        <p className="max-w-[60ch] animate-rise text-lg text-ink-2 [animation-delay:80ms]">
          Введите название и автора. AI соберёт саммари, главные идеи, критический разбор
          и план внедрения — и покажет, что взято из книги, а что является его
          интерпретацией.
        </p>
        <SearchForm className="mt-2 animate-rise [animation-delay:120ms]" />
      </div>
      <div className="mx-auto w-full max-w-md animate-rise [animation-delay:160ms] lg:max-w-none">
        <SlideSketch />
      </div>
    </section>
  );
}

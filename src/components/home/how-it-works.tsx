import type { ReactNode } from "react";

const sketch = "h-20 w-full fill-none stroke-current stroke-[1.5] text-ink-2";

function SearchSketch() {
  return (
    <svg viewBox="0 0 160 80" aria-hidden="true" className={sketch}>
      <rect x="8" y="24" width="144" height="32" rx="8" />
      <path d="M22 40h58" strokeLinecap="round" strokeWidth="3" />
      <path d="M86 34v12" strokeLinecap="round" className="stroke-accent" />
      <circle cx="130" cy="38.5" r="6" className="stroke-accent" strokeWidth="2" />
      <path
        d="m134.5 43 4.5 4.5"
        strokeLinecap="round"
        className="stroke-accent"
        strokeWidth="2"
      />
    </svg>
  );
}

function ConfirmSketch() {
  return (
    <svg viewBox="0 0 160 80" aria-hidden="true" className={sketch}>
      <rect x="22" y="8" width="44" height="64" rx="4" />
      <path d="M30 8v64" />
      <path d="M38 24h20M38 32h14" strokeLinecap="round" />
      <path d="M82 22h56M82 34h40M82 46h48" strokeLinecap="round" />
      <circle
        cx="66"
        cy="62"
        r="11"
        className="fill-surface stroke-accent"
        strokeWidth="2"
      />
      <path
        d="m61 62 3.5 3.5 6.5-7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-accent"
        strokeWidth="2"
      />
    </svg>
  );
}

function DeckSketch() {
  return (
    <svg viewBox="0 0 160 80" aria-hidden="true" className={sketch}>
      <rect x="40" y="6" width="96" height="54" rx="6" opacity="0.45" />
      <rect x="24" y="16" width="96" height="54" rx="6" className="fill-surface" />
      <path d="M36 30h44" strokeLinecap="round" strokeWidth="3" />
      <circle cx="39" cy="44" r="3" className="fill-src-book stroke-none" />
      <path d="M48 44h58" strokeLinecap="round" />
      <path d="m39 52.5 3 3-3 3-3-3Z" className="fill-src-ai stroke-none" />
      <path d="M48 55.5h42" strokeLinecap="round" />
    </svg>
  );
}

const steps: { title: string; text: string; sketch: ReactNode }[] = [
  {
    title: "Назовите книгу",
    text: "Введите название и автора. Мы найдём произведение в каталоге и покажем его издания.",
    sketch: <SearchSketch />,
  },
  {
    title: "Подтвердите издание",
    text: "До запуска вы увидите, какие источники о книге найдены, а каких не хватает.",
    sketch: <ConfirmSketch />,
  },
  {
    title: "Изучайте презентацию",
    text: "Саммари, идеи, критика и план внедрения — по слайдам. У каждого утверждения есть метка и источник.",
    sketch: <DeckSketch />,
  },
];

export function HowItWorks() {
  return (
    <section
      id="how"
      aria-labelledby="how-title"
      className="scroll-mt-8 border-t border-line bg-surface"
    >
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <h2 id="how-title" className="text-title">
          Как это работает
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="flex flex-col gap-4 rounded-card border border-line bg-page p-6"
            >
              <div className="rounded-control bg-surface px-4 py-3">{step.sketch}</div>
              <div className="flex flex-col gap-2">
                <p className="text-label text-accent">
                  <span className="sr-only">Шаг </span>
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-heading">{step.title}</h3>
                <p className="text-ink-2">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

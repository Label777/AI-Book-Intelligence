"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { PresentationData } from "@/analysis/types";
import { SlideBlocks } from "@/components/presentation/blocks";
import { SourceDialog, SourceLine } from "@/components/presentation/source-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { Slide } from "@/pipeline/schema";

const MODE_NAME: Record<PresentationData["mode"], string> = {
  sources_only: "По открытым источникам",
  full_text: "По полному тексту",
};

const DESKTOP = "(min-width: 1024px)";
function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const subscribeNothing = () => () => {};

const slideAnchor = (index: number) => `slide-${index + 1}`;
const number = (index: number) => String(index + 1).padStart(2, "0");

function SlideCard({
  slide,
  index,
  total,
  children,
}: {
  slide: Slide;
  index: number;
  total: number;
  children: React.ReactNode;
}) {
  return (
    <article
      id={slideAnchor(index)}
      data-slide={index}
      aria-labelledby={`${slideAnchor(index)}-title`}
      className="scroll-mt-32 rounded-slide border border-line bg-surface p-5 shadow-card sm:p-8 lg:p-10"
    >
      <p className="text-label text-accent">
        {number(index)} / {number(total - 1)}
      </p>
      <h2
        id={`${slideAnchor(index)}-title`}
        className="mt-2 mb-6 text-title wrap-anywhere"
      >
        {slide.title}
      </h2>
      {children}
    </article>
  );
}

/** Просмотрщик презентации: слайды по одному на большом экране, лента карточек на телефоне. */
export function Presentation({ data }: { data: PresentationData }) {
  const { slides } = data;
  const isDesktop = useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
  const [mode, setMode] = useState<"slides" | "reading">("slides");
  const [current, setCurrent] = useState(0);
  const [claimId, setClaimId] = useState<string | null>(null);
  const canFullscreen = useSyncExternalStore(
    subscribeNothing,
    () => document.fullscreenEnabled === true,
    () => false,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLDialogElement>(null);
  const aboutRef = useRef<HTMLDialogElement>(null);

  // На телефоне всегда лента: листать её привычнее, чем нажимать «дальше».
  const paged = isDesktop && mode === "slides";
  const ctx = { data, onOpenClaim: setClaimId };

  const goTo = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(slides.length - 1, index));
      setCurrent(next);
      history.replaceState(null, "", `#${slideAnchor(next)}`);
      if (!paged)
        document.getElementById(slideAnchor(next))?.scrollIntoView({ block: "start" });
      else rootRef.current?.scrollIntoView({ block: "start" });
    },
    [paged, slides.length],
  );

  // Слайд из адреса: ссылкой на конкретный слайд можно поделиться.
  useEffect(() => {
    const apply = () => {
      const match = /^#slide-(\d+)$/.exec(window.location.hash);
      const index = match ? Number(match[1]) - 1 : -1;
      if (index >= 0 && index < slides.length) setCurrent(index);
    };
    const frame = requestAnimationFrame(apply);
    window.addEventListener("hashchange", apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", apply);
    };
  }, [slides.length]);

  // В ленте текущий слайд — тот, что сейчас на экране.
  useEffect(() => {
    if (paged) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setCurrent(Number((entry.target as HTMLElement).dataset.slide));
        }
      },
      { rootMargin: "-40% 0px -55% 0px" },
    );
    document
      .querySelectorAll("[data-slide]")
      .forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [paged]);

  // Клавиатура в режиме слайдов.
  useEffect(() => {
    if (!paged) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("dialog, input, textarea, select")) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") goTo(current + 1);
      else if (event.key === "ArrowLeft" || event.key === "PageUp") goTo(current - 1);
      else if (event.key === "Home") goTo(0);
      else if (event.key === "End") goTo(slides.length - 1);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paged, current, goTo, slides.length]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  };

  const navigatorList = (inDialog: boolean) => (
    <ol className="flex flex-col gap-0.5">
      {slides.map((slide, index) => (
        <li key={slide.id}>
          <a
            href={`#${slideAnchor(index)}`}
            aria-current={index === current ? "true" : undefined}
            onClick={(event) => {
              event.preventDefault();
              if (inDialog) navigatorRef.current?.close();
              goTo(index);
            }}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-control px-3 py-1.5 text-sm transition-colors duration-150",
              index === current
                ? "bg-surface-2 font-semibold text-ink"
                : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <span className="text-label-sm">{number(index)}</span>
            <span className="wrap-anywhere">{slide.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  const iconButton =
    "inline-flex size-11 cursor-pointer items-center justify-center rounded-control border border-line-strong bg-surface text-ink transition-colors duration-150 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40";
  const visible = paged ? [current] : slides.map((_, index) => index);

  return (
    <div ref={rootRef} className="flex flex-col bg-page [&:fullscreen]:overflow-y-auto">
      {/* Шапка презентации: книга и режим анализа видны на каждом экране. */}
      <div className="sticky top-0 z-20 border-b border-line bg-page/95 backdrop-blur">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
          <Link
            href={`/book/${data.book.workId}`}
            className="-ml-2 inline-flex min-h-11 items-center px-2 text-sm text-ink-2 hover:text-ink"
          >
            ← <span className="ml-1 max-sm:sr-only">К книге</span>
          </Link>
          <div className="min-w-0 flex-1 basis-40">
            <h1 className="truncate font-serif text-lg font-semibold">
              {data.book.title}
            </h1>
            <p className="truncate text-sm text-ink-2">{data.book.authors.join(", ")}</p>
          </div>
          <button
            type="button"
            data-testid="analysis-mode"
            onClick={() => aboutRef.current?.showModal()}
            className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-line bg-surface-2 px-3 text-label-sm text-ink hover:border-line-strong"
          >
            {MODE_NAME[data.mode]}
          </button>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-page gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8 lg:py-8">
        <nav aria-label="Слайды" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-11rem)] overflow-y-auto pr-1">
            {navigatorList(false)}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-6 pb-20">
          {visible.map((index) => (
            <SlideCard
              key={slides[index].id}
              slide={slides[index]}
              index={index}
              total={slides.length}
            >
              <SlideBlocks slide={slides[index]} ctx={ctx} />
            </SlideCard>
          ))}
        </div>
      </div>

      {/* Нижняя панель: навигация, прогресс, режим. */}
      <div className="sticky bottom-0 z-20 border-t border-line bg-surface">
        <div className="mx-auto flex max-w-page items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 0}
            aria-label="Предыдущий слайд"
            className={iconButton}
          >
            <span aria-hidden="true">←</span>
          </button>
          <p
            aria-live="polite"
            data-testid="slide-counter"
            className="min-w-16 text-center text-label"
          >
            <span className="sr-only">Слайд </span>
            {current + 1} / {slides.length}
          </p>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === slides.length - 1}
            aria-label="Следующий слайд"
            className={iconButton}
          >
            <span aria-hidden="true">→</span>
          </button>
          <div
            aria-hidden="true"
            className="hidden h-1 flex-1 rounded-full bg-surface-2 sm:block"
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${((current + 1) / slides.length) * 100}%` }}
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="lg:hidden">
              <Button
                variant="secondary"
                onClick={() => navigatorRef.current?.showModal()}
              >
                Слайды
              </Button>
            </div>
            <div
              role="group"
              aria-label="Режим просмотра"
              className="hidden gap-1 lg:flex"
            >
              {(["slides", "reading"] as const).map((value) => (
                <Button
                  key={value}
                  variant={mode === value ? "secondary" : "ghost"}
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                >
                  {value === "slides" ? "Слайды" : "Чтение"}
                </Button>
              ))}
            </div>
            {canFullscreen ? (
              <div className="hidden lg:block">
                <Button variant="ghost" onClick={toggleFullscreen}>
                  Во весь экран
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Список слайдов на телефоне. */}
      <dialog
        ref={navigatorRef}
        aria-label="Слайды"
        onClick={(event) => {
          if (event.target === navigatorRef.current) navigatorRef.current?.close();
        }}
        className="backdrop:bg-black/60 mt-auto mb-0 max-h-[80dvh] w-full max-w-none rounded-t-card border border-line bg-surface p-3 text-ink"
      >
        {navigatorList(true)}
        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => navigatorRef.current?.close()}
        >
          Закрыть
        </Button>
      </dialog>

      {/* Как сделан анализ: режим, проверка, список источников. */}
      <dialog
        ref={aboutRef}
        aria-labelledby="about-title"
        onClick={(event) => {
          if (event.target === aboutRef.current) aboutRef.current?.close();
        }}
        className="backdrop:bg-black/60 m-auto max-h-[85dvh] w-[min(40rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink"
      >
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <h2 id="about-title" className="text-heading">
            Как сделан этот анализ
          </h2>
          <p className="text-ink-2">
            {data.mode === "sources_only"
              ? "Текста книги у нас нет. Анализ построен на открытых источниках: описаниях, рецензиях, интервью. Факты проверены по дословным выдержкам из них."
              : "Анализ построен по тексту книги, который загрузил пользователь."}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ["Источников", data.sources.length],
              ["Проверено фактов", data.report.checked],
              ["Подтверждено", data.report.supported],
              ["Понижено до мнения AI", data.report.downgraded],
              ["Удалено", data.report.removed + data.report.cascaded],
            ].map(([label, value]) => (
              <div key={label} className="rounded-control bg-surface-2 px-3 py-2">
                <dt className="text-label-sm text-ink-2">{label}</dt>
                <dd className="text-lg font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {data.coverage.missing.length > 0 ? (
            <section>
              <h3 className="text-label text-accent">Чего не хватило</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">
                {data.coverage.missing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h3 className="text-label text-accent">Источники</h3>
            <ul className="mt-3 flex flex-col gap-3">
              {data.sources.map((source) => (
                <li key={source.id}>
                  <SourceLine source={source} />
                </li>
              ))}
            </ul>
          </section>
          <Button
            variant="secondary"
            className="self-end"
            onClick={() => aboutRef.current?.close()}
          >
            Закрыть
          </Button>
        </div>
      </dialog>

      <SourceDialog
        data={data}
        claimId={claimId}
        onClose={() => setClaimId(null)}
        onOpenClaim={setClaimId}
      />
    </div>
  );
}

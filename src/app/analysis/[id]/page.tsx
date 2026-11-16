import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getAnalysisService } from "@/analysis/service";
import type { AnalysisStatus, StepProgress } from "@/analysis/types";
import { resumeAnalysisAction } from "@/app/analysis/actions";
import { AutoRefresh } from "@/components/presentation/auto-refresh";
import { Presentation } from "@/components/presentation/presentation";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import type { StepName } from "@/pipeline";

export const metadata: Metadata = {
  title: "Анализ книги",
  robots: { index: false },
};

const STEP_TITLE: Record<StepName, string> = {
  identify: "Проверяем сведения о книге",
  sources: "Ищем и проверяем источники",
  structure: "Определяем структуру книги",
  summary: "Собираем факты и обзор",
  analysis: "Разбираем идеи, критику и связи",
  visuals: "Строим схемы концепций",
  assemble: "Собираем слайды",
  verify: "Проверяем факты по источникам",
};

const COVERAGE: Record<NonNullable<AnalysisStatus["coverage"]>["level"], string> = {
  sufficient: "Источников достаточно для полного анализа.",
  limited: "Источников мало: часть разделов может остаться пустой.",
  insufficient: "Источников недостаточно для достоверного анализа.",
};

const linkClass =
  "inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:no-underline";

function StepMark({ status }: { status: StepProgress["status"] }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full border text-label-sm",
        status === "done" && "border-src-book text-src-book",
        status === "running" && "animate-pulse-soft border-accent text-accent",
        status === "failed" && "border-src-critique text-src-critique",
        status === "pending" && "border-line text-ink-2",
      )}
    >
      {status === "done"
        ? "✓"
        : status === "failed"
          ? "!"
          : status === "running"
            ? "•"
            : ""}
    </span>
  );
}

const STEP_STATE: Record<StepProgress["status"], string> = {
  done: "готово",
  running: "выполняется",
  failed: "ошибка",
  pending: "ожидает",
};

function Progress({ status, busy }: { status: AnalysisStatus; busy: boolean }) {
  const { meta, phase, steps, coverage, sourceCount, reasons } = status;
  const book = meta.request.book;
  const heading: Record<Exclude<AnalysisStatus["phase"], "ready">, string> = {
    running: "Создаём анализ",
    interrupted: "Анализ прерван",
    halted: "Анализ не создан: мало источников",
    unpublishable: "Анализ не прошёл проверку",
    failed: "Не удалось создать анализ",
  };
  if (phase === "ready") return null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      {phase === "running" ? <AutoRefresh /> : null}
      <header className="flex flex-col gap-2">
        <p className="text-label text-accent">По открытым источникам</p>
        <h1 className="text-title">{heading[phase]}</h1>
        <p className="text-lg text-ink-2">
          {book.title} · {book.authors.join(", ")}
        </p>
      </header>

      {phase === "running" ? (
        <p className="max-w-[70ch] text-ink-2">
          Обычно это занимает несколько минут. Страницу можно закрыть — анализ
          продолжится, а готовый результат откроется по этому же адресу.
        </p>
      ) : null}
      {phase === "interrupted" ? (
        <p className="max-w-[70ch] text-ink-2">
          Сервер перезапустился, пока шла работа. Готовые шаги сохранены — анализ можно
          продолжить с места остановки.
        </p>
      ) : null}
      {phase === "halted" || phase === "unpublishable" || phase === "failed" ? (
        <div role="alert" className="rounded-card border border-line bg-surface p-6">
          {phase === "halted" ? (
            <p className="max-w-[70ch]">
              Мы не показываем анализ, который не на чем проверить: без достаточного числа
              источников пришлось бы выдавать догадки за содержание книги.
            </p>
          ) : null}
          {phase === "unpublishable" ? (
            <p className="max-w-[70ch]">
              После проверки фактов подтверждённого материала осталось слишком мало, чтобы
              показать его как анализ книги.
            </p>
          ) : null}
          {reasons.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-2">
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {busy ? (
        <p role="alert" className="text-src-critique">
          Сейчас создаётся слишком много анализов. Попробуйте через несколько минут.
        </p>
      ) : null}

      <ol aria-label="Шаги анализа" className="flex flex-col gap-3">
        {steps.map((item) => (
          <li
            key={item.step}
            data-step={item.step}
            data-status={item.status}
            className="flex items-center gap-3"
          >
            <StepMark status={item.status} />
            <span className={item.status === "pending" ? "text-ink-2" : undefined}>
              {STEP_TITLE[item.step]}
              <span className="sr-only"> — {STEP_STATE[item.status]}</span>
            </span>
          </li>
        ))}
      </ol>

      {coverage ? (
        <section
          aria-labelledby="coverage-title"
          className="rounded-card border border-line bg-surface p-6"
        >
          <h2 id="coverage-title" className="font-medium">
            Найдено источников: {sourceCount}
          </h2>
          <p className="mt-1 text-ink-2">{COVERAGE[coverage.level]}</p>
          {coverage.missing.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-2">
              {coverage.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        {phase === "interrupted" || phase === "failed" ? (
          getAnalysisService().available ? (
            <form action={resumeAnalysisAction}>
              <input type="hidden" name="id" value={meta.id} />
              <Button type="submit">Продолжить анализ</Button>
            </form>
          ) : (
            <p className="text-ink-2">
              Продолжить нельзя: на сервере не задан ключ Claude API.
            </p>
          )
        ) : null}
        <Link href={`/book/${book.workId}`} className={linkClass}>
          ← К странице книги
        </Link>
      </div>
    </div>
  );
}

async function AnalysisContent({ params, searchParams }: PageProps<"/analysis/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await connection();

  const service = getAnalysisService();
  const status = await service.status(id);
  if (!status) notFound();

  if (status.phase === "ready") {
    const data = await service.presentation(id);
    if (data) return <Presentation data={data} />;
  }
  return <Progress status={status} busy={query.busy === "1"} />;
}

function Fallback() {
  return (
    <div role="status" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <span className="sr-only">Загружаем анализ…</span>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-10 w-3/4" />
      <SkeletonText lines={5} className="mt-8" />
    </div>
  );
}

export default function AnalysisPage(props: PageProps<"/analysis/[id]">) {
  return (
    <Suspense fallback={<Fallback />}>
      <AnalysisContent {...props} />
    </Suspense>
  );
}

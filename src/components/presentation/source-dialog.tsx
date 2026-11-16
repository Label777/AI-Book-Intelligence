"use client";

import { useEffect, useRef } from "react";
import type { PresentationData } from "@/analysis/types";
import { Button } from "@/components/ui/button";
import { ProvenanceLabel } from "@/components/ui/provenance-label";
import { PROVENANCE } from "@/lib/provenance";
import type { Claim, Source } from "@/pipeline/schema";

const KIND: Record<Source["kind"], string> = {
  description: "Описание книги",
  toc: "Оглавление",
  encyclopedia: "Энциклопедия",
  review: "Рецензия",
  interview: "Интервью",
  research: "Исследование",
  user_text: "Текст книги",
  other: "Другой источник",
};

const RELIABILITY: Record<Source["reliability"], string> = {
  high: "надёжность высокая",
  medium: "надёжность средняя",
  low: "надёжность низкая",
};

const VERIFICATION: Record<Claim["verification"], string> = {
  supported: "Проверено: источник подтверждает утверждение.",
  partial: "Проверено: источник подтверждает утверждение частично.",
  unsupported: "Проверка не подтвердила утверждение.",
  unverified: "",
};

function safeUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function SourceLine({ source }: { source: Source }) {
  const url = safeUrl(source.url);
  return (
    <>
      <span className="font-medium wrap-anywhere">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:no-underline"
          >
            {source.title}
          </a>
        ) : (
          source.title
        )}
      </span>
      <span className="block text-label-sm text-ink-2">
        {[KIND[source.kind], source.domain, RELIABILITY[source.reliability]]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </>
  );
}

interface Props {
  data: PresentationData;
  claimId: string | null;
  onClose: () => void;
  onOpenClaim: (claimId: string) => void;
}

/** Карточка источника: откуда взято утверждение и на чём оно основано. */
export function SourceDialog({ data, claimId, onClose, onOpenClaim }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const claim = claimId ? data.claims[claimId] : undefined;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (claim && !dialog.open) dialog.showModal();
    if (!claim && dialog.open) dialog.close();
  }, [claim]);

  const info = claim ? PROVENANCE[claim.type] : undefined;
  const basis = claim?.basedOn.flatMap((id) => data.claims[id] ?? []) ?? [];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // Клик по затемнению вокруг карточки закрывает её.
        if (event.target === ref.current) ref.current?.close();
      }}
      aria-labelledby="source-dialog-title"
      className="backdrop:bg-black/60 m-auto max-h-[85dvh] w-[min(40rem,calc(100vw-2rem))] rounded-card border border-line bg-surface p-0 text-ink"
    >
      {claim && info ? (
        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <header className="flex flex-col items-start gap-2">
            <ProvenanceLabel type={claim.type} />
            <h2 id="source-dialog-title" className="text-heading">
              {info.name}
            </h2>
            <p className="text-sm text-ink-2">{info.description}</p>
          </header>

          <p className="rounded-control bg-surface-2 px-4 py-3 wrap-anywhere">
            {claim.text}
          </p>

          {claim.downgradedFrom ? (
            <p className="text-sm text-ink-2">
              Сначала это было отмечено как «{PROVENANCE[claim.downgradedFrom].name}», но
              проверка подтвердила утверждение лишь частично, поэтому оно показано как
              интерпретация AI.
            </p>
          ) : null}

          {claim.evidence.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-label text-accent">Источники</h3>
              <ul className="flex flex-col gap-4">
                {claim.evidence.map((evidence, index) => {
                  const source = data.sources.find(
                    (item) => item.id === evidence.sourceId,
                  );
                  if (!source) return null;
                  const excerpt = source.excerpts.find(
                    (item) => item.id === evidence.excerptId,
                  );
                  return (
                    <li key={index} className="flex flex-col gap-2">
                      <div>
                        <SourceLine source={source} />
                      </div>
                      {excerpt ? (
                        <blockquote className="border-l-2 border-line-strong pl-3 text-sm wrap-anywhere text-ink-2">
                          {excerpt.text}
                        </blockquote>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {basis.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="text-label text-accent">На чём основан вывод</h3>
              <ul className="flex flex-col gap-3">
                {basis.map((item) => (
                  <li key={item.id} className="flex flex-col items-start gap-1">
                    <button
                      type="button"
                      onClick={() => onOpenClaim(item.id)}
                      className="-my-1.5 inline-flex min-h-11 cursor-pointer items-center rounded-full"
                    >
                      <ProvenanceLabel type={item.type} />
                      <span className="sr-only"> — открыть источник</span>
                    </button>
                    <p className="text-sm wrap-anywhere">{item.text}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {claim.evidence.length === 0 && basis.length === 0 ? (
            <p className="text-sm text-ink-2">
              Для этого утверждения не сохранено ссылок на источники.
            </p>
          ) : null}

          {VERIFICATION[claim.verification] ? (
            <p className="text-sm text-ink-2">{VERIFICATION[claim.verification]}</p>
          ) : null}

          <Button
            variant="secondary"
            onClick={() => ref.current?.close()}
            className="self-end"
          >
            Закрыть
          </Button>
        </div>
      ) : null}
    </dialog>
  );
}

"use client";

import type { PresentationData } from "@/analysis/types";
import { DiagramView } from "@/components/presentation/diagram";
import { ProvenanceLabel } from "@/components/ui/provenance-label";
import type { Action, Slide, SlideBlock } from "@/pipeline/schema";

export interface BlockContext {
  data: PresentationData;
  /** Открыть карточку источника утверждения. */
  onOpenClaim: (claimId: string) => void;
}

const HORIZON: Record<Action["horizon"], string> = {
  "24h": "Первые 24 часа",
  "7d": "Первые 7 дней",
  "30d": "Первые 30 дней",
};

/** Утверждение: метка-кнопка открывает источник, рядом текст. */
function ClaimLine({
  claimId,
  role,
  ctx,
  large = false,
}: {
  claimId: string;
  role: string | null;
  ctx: BlockContext;
  large?: boolean;
}) {
  const claim = ctx.data.claims[claimId];
  if (!claim) return null;
  return (
    <div data-claim={claim.id} className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-x-3">
        <button
          type="button"
          onClick={() => ctx.onOpenClaim(claim.id)}
          className="-my-1.5 inline-flex min-h-11 cursor-pointer items-center rounded-full"
        >
          <ProvenanceLabel type={claim.type} />
          <span className="sr-only"> — открыть источник</span>
        </button>
        {role ? <span className="text-label-sm text-ink-2">{role}</span> : null}
      </div>
      <p className={large ? "text-lg wrap-anywhere" : "wrap-anywhere"}>{claim.text}</p>
      {claim.quote ? (
        <blockquote className="border-l-2 border-line-strong pl-3 font-serif text-ink-2 italic">
          «{claim.quote.text}»
        </blockquote>
      ) : null}
    </div>
  );
}

function ActionLine({ actionId, ctx }: { actionId: string; ctx: BlockContext }) {
  const action = ctx.data.actions[actionId];
  if (!action) return null;
  return (
    <div
      data-action={action.id}
      className="flex flex-col gap-1.5 rounded-control border border-line bg-surface-2 px-4 py-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-label-sm text-accent">Что с этим делать</span>
        <span className="text-label-sm text-ink-2">{HORIZON[action.horizon]}</span>
      </div>
      <p className="wrap-anywhere">{action.text}</p>
      <button
        type="button"
        onClick={() => ctx.onOpenClaim(action.claimId)}
        className="-my-1 inline-flex min-h-11 cursor-pointer items-center self-start text-sm text-ink-2 underline underline-offset-4 hover:text-ink"
      >
        Из какой идеи это следует
      </button>
    </div>
  );
}

function Block({ block, ctx }: { block: SlideBlock; ctx: BlockContext }) {
  switch (block.kind) {
    case "meta":
      return (
        <p className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-label-sm text-ink-2">{block.label}</span>
          <span className="font-medium wrap-anywhere">{block.value}</span>
        </p>
      );
    case "claim":
      return <ClaimLine claimId={block.claimId} role={block.role} ctx={ctx} large />;
    case "item":
      return (
        <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:p-5">
          <header>
            <h3 className="text-heading wrap-anywhere">{block.title}</h3>
            {block.subtitle ? <p className="text-ink-2">{block.subtitle}</p> : null}
          </header>
          {block.claims.map((claim) => (
            <ClaimLine
              key={claim.claimId}
              claimId={claim.claimId}
              role={claim.role}
              ctx={ctx}
            />
          ))}
          {block.actionId ? <ActionLine actionId={block.actionId} ctx={ctx} /> : null}
        </article>
      );
    case "action":
      return <ActionLine actionId={block.actionId} ctx={ctx} />;
    case "diagram":
      return <DiagramView diagram={block.diagram} />;
    case "score":
      return (
        <div data-score={block.dimension} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{block.label}</span>
            <span className="text-label text-ink-2">
              <span className="text-lg font-semibold text-ink">{block.value}</span> из 10
            </span>
          </div>
          <div
            role="img"
            aria-label={`${block.label}: ${block.value} из 10, оценка AI`}
            className="h-1.5 rounded-full bg-surface-2"
          >
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${block.value * 10}%` }}
            />
          </div>
          <ClaimLine claimId={block.claimId} role="Почему такая оценка" ctx={ctx} />
        </div>
      );
    case "note":
      return (
        <p className="rounded-control bg-surface-2 px-4 py-3 text-sm text-ink-2">
          {block.text}
        </p>
      );
  }
}

/** Блоки слайда; подряд идущие блоки одной группы получают общий подзаголовок. */
export function SlideBlocks({ slide, ctx }: { slide: Slide; ctx: BlockContext }) {
  const groups: { name: string | null; blocks: SlideBlock[] }[] = [];
  for (const block of slide.blocks) {
    const last = groups.at(-1);
    if (last && last.name === block.group) last.blocks.push(block);
    else groups.push({ name: block.group, blocks: [block] });
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group, index) => (
        <section key={index} className="flex flex-col gap-4">
          {group.name ? <h3 className="text-label text-accent">{group.name}</h3> : null}
          {group.blocks.map((block, blockIndex) => (
            <Block key={blockIndex} block={block} ctx={ctx} />
          ))}
        </section>
      ))}
    </div>
  );
}

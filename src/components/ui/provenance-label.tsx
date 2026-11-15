import { cn } from "@/lib/cn";
import { PROVENANCE, type ProvenanceShape, type ProvenanceType } from "@/lib/provenance";

const colors: Record<ProvenanceType, string> = {
  book_fact: "text-src-book",
  ai_interpretation: "text-src-ai",
  external_research: "text-src-research",
  critique: "text-src-critique",
};

function Shape({ shape }: { shape: ProvenanceShape }) {
  return (
    <svg
      viewBox="0 0 10 10"
      aria-hidden="true"
      data-shape={shape}
      className="size-2.5 shrink-0 fill-current"
    >
      {shape === "circle" && <circle cx="5" cy="5" r="4.5" />}
      {shape === "diamond" && <path d="M5 0 10 5 5 10 0 5Z" />}
      {shape === "triangle" && <path d="M5 0.5 10 9.5H0Z" />}
      {shape === "square" && <rect x="0.75" y="0.75" width="8.5" height="8.5" />}
    </svg>
  );
}

export interface ProvenanceLabelProps {
  type: ProvenanceType;
  className?: string;
}

/**
 * Метка происхождения утверждения: форма + подпись + цвет.
 * Экранный диктор читает полное название типа, а не сокращение.
 */
export function ProvenanceLabel({ type, className }: ProvenanceLabelProps) {
  const info = PROVENANCE[type];
  return (
    <span
      data-provenance={type}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-current/35 px-2.5 py-0.5 text-label-sm font-medium whitespace-nowrap",
        colors[type],
        className,
      )}
    >
      <Shape shape={info.shape} />
      <span aria-hidden="true">{info.label}</span>
      <span className="sr-only">{info.name}</span>
    </span>
  );
}

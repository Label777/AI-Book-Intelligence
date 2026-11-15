import { cn } from "@/lib/cn";

/** Знак продукта: четыре формы меток происхождения. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <circle cx="6.5" cy="6.5" r="4.5" className="fill-src-book" />
      <path d="M17.5 1.5 22.5 6.5 17.5 11.5 12.5 6.5Z" className="fill-src-ai" />
      <path d="M6.5 13 11.5 22H1.5Z" className="fill-src-research" />
      <rect x="13.5" y="13.5" width="8" height="8" className="fill-src-critique" />
    </svg>
  );
}

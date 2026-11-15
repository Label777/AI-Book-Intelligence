import { cn } from "@/lib/cn";

export interface SkeletonProps {
  className?: string;
}

/** Заглушка загрузки: повторяет форму будущего содержимого. Размер задаётся классами. */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      data-skeleton=""
      className={cn(
        "block animate-pulse-soft rounded-control bg-surface-2 motion-reduce:animate-none",
        className,
      )}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

/** Несколько строк текста; последняя короче, как в настоящем абзаце. */
export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span aria-hidden="true" className={cn("flex flex-col gap-2.5", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 && lines > 1 ? "w-3/5" : "w-full")}
        />
      ))}
    </span>
  );
}

/** Заглушка по форме карточки книги. */
export function BookCardSkeleton({ className }: SkeletonProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex gap-4 rounded-card border border-line bg-surface p-4",
        className,
      )}
    >
      <Skeleton className="aspect-[2/3] w-20 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3 py-1">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="mt-auto h-3 w-1/3" />
      </div>
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}

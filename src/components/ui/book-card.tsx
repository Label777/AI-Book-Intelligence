import Link from "next/link";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/plural";

export interface BookCardProps {
  title: string;
  authors: string[];
  /** Куда ведёт карточка, например /book/OL123W. */
  href: string;
  /** Год первой публикации. */
  year?: number;
  /** Обложка издания. Если её нет, показывается типографическая обложка. */
  coverUrl?: string;
  editionCount?: number;
  className?: string;
}

/** Карточка книги: обложка, название, автор, год первой публикации, число изданий. */
export function BookCard({
  title,
  authors,
  href,
  year,
  coverUrl,
  editionCount,
  className,
}: BookCardProps) {
  const authorLine = authors.join(", ");
  const meta = [
    year ? String(year) : null,
    editionCount
      ? `${editionCount} ${plural(editionCount, "издание", "издания", "изданий")}`
      : null,
  ].filter(Boolean);

  return (
    <Link
      href={href}
      className={cn(
        "group flex gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-colors duration-150 hover:border-line-strong",
        className,
      )}
    >
      <div className="aspect-[2/3] w-20 shrink-0 overflow-hidden rounded-control bg-surface-2">
        {coverUrl ? (
          // Обложки приходят с внешних каталогов; оптимизация изображений настраивается на этапе 5.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          // Типографическая обложка: не имитирует официальную.
          <div
            aria-hidden="true"
            data-cover="typographic"
            className="flex size-full flex-col justify-between border-l-4 border-accent p-2"
          >
            <span className="line-clamp-4 font-serif text-[0.6875rem] leading-tight font-semibold wrap-anywhere text-ink">
              {title}
            </span>
            <span className="line-clamp-2 text-[0.5625rem] leading-tight text-ink-2">
              {authorLine}
            </span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
        <h3 className="line-clamp-2 font-serif text-lg leading-snug font-semibold text-ink group-hover:text-accent">
          {title}
        </h3>
        {authorLine ? (
          <p className="line-clamp-1 text-sm text-ink-2">{authorLine}</p>
        ) : null}
        {meta.length > 0 ? (
          <p className="mt-auto pt-2 text-label-sm text-ink-2">{meta.join(" · ")}</p>
        ) : null}
      </div>
    </Link>
  );
}

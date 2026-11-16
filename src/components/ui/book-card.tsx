import Link from "next/link";
import { BookCover } from "@/components/ui/book-cover";
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
  /** Уровень заголовка: h3 в списке, h2 — когда карточка стоит отдельно. */
  headingLevel?: "h2" | "h3";
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
  headingLevel: Heading = "h3",
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
      <BookCover title={title} authors={authors} coverUrl={coverUrl} className="w-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-1">
        <Heading className="line-clamp-2 font-serif text-lg leading-snug font-semibold text-ink group-hover:text-accent">
          {title}
        </Heading>
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

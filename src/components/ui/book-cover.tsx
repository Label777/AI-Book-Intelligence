"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export interface BookCoverProps {
  title: string;
  authors: string[];
  /** Обложка издания. Если её нет или она не загрузилась, показывается типографическая обложка. */
  coverUrl?: string;
  /** Размер текста типографической обложки. */
  size?: "sm" | "lg";
  /** Ширина задаётся классами снаружи, высота следует из пропорции 2 : 3. */
  className?: string;
}

const textSizes = {
  sm: { title: "text-[0.6875rem]", author: "text-[0.5625rem]", pad: "p-2" },
  lg: { title: "text-base", author: "text-xs", pad: "p-4" },
};

/** Обложка книги: настоящая или типографическая, которая не имитирует официальную. */
export function BookCover({
  title,
  authors,
  coverUrl,
  size = "sm",
  className,
}: BookCoverProps) {
  // Запоминаем адрес, который не загрузился: у другой обложки будет новая попытка.
  const [failedUrl, setFailedUrl] = useState<string>();
  const showImage = coverUrl !== undefined && coverUrl !== failedUrl;
  const text = textSizes[size];

  return (
    <div
      className={cn(
        "aspect-[2/3] shrink-0 overflow-hidden rounded-control bg-surface-2",
        className,
      )}
    >
      {showImage ? (
        // Обложки отдаёт внешний каталог; текст рядом уже называет книгу, поэтому alt пустой.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(coverUrl)}
          className="size-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          data-cover="typographic"
          className={cn(
            "flex size-full flex-col justify-between border-l-4 border-accent",
            text.pad,
          )}
        >
          <span
            className={cn(
              "line-clamp-4 font-serif leading-tight font-semibold wrap-anywhere text-ink",
              text.title,
            )}
          >
            {title}
          </span>
          <span className={cn("line-clamp-2 leading-tight text-ink-2", text.author)}>
            {authors.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

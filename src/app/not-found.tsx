import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 px-4 py-20 sm:px-6 lg:px-8">
      <p className="text-label text-accent">404</p>
      <h1 className="text-title">Страница не найдена</h1>
      <p className="max-w-[60ch] text-ink-2">
        Возможно, ссылка устарела или в адресе опечатка.
      </p>
      <Link href="/" className={buttonClasses("primary", "md", "mt-2")}>
        На главную
      </Link>
    </div>
  );
}

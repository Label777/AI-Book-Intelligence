import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SearchClient } from "@/components/static/search-client";

export const metadata: Metadata = { title: "Поиск книги", robots: { index: false } };

// Страница статической сборки (GitHub Pages): подменяет src/app/search при сборке.
export default function SearchPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
      <h1 className="text-title">Поиск книги</h1>
      <div className="mt-8">
        <Suspense fallback={null}>
          <SearchClient />
        </Suspense>
      </div>
      <p className="mt-10">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 hover:no-underline"
        >
          ← На главную
        </Link>
      </p>
    </div>
  );
}

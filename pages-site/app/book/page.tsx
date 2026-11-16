import type { Metadata } from "next";
import { Suspense } from "react";
import { BookClient } from "@/components/static/book-client";

export const metadata: Metadata = {
  title: "Подтверждение книги",
  robots: { index: false },
};

// Страница статической сборки (GitHub Pages): подменяет src/app/book при сборке.
export default function BookPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <Suspense fallback={null}>
        <BookClient />
      </Suspense>
    </div>
  );
}

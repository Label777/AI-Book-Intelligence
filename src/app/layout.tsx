import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/literata";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { themeInitScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "AI Book Intelligence — знания из книги, а не пересказ",
    template: "%s · AI Book Intelligence",
  },
  description:
    "Введите название книги и автора — AI разберёт идеи, покажет слабые места, свяжет книгу с другими и предложит план действий. У каждого утверждения видно, откуда оно взято.",
};

export const viewport: Viewport = {
  themeColor: "#0d0e12",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: скрипт ниже может поставить data-theme до гидрации.
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex flex-col">
        <a
          href="#main"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:rounded-control focus-visible:bg-surface focus-visible:px-4 focus-visible:py-2.5 focus-visible:text-ink"
        >
          Перейти к содержимому
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}

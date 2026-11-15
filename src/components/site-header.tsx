import Link from "next/link";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";

const navLinks = [
  { href: "/#how", label: "Как это работает" },
  { href: "/#sources", label: "Источники" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-11 items-center gap-2.5 rounded-control px-2 font-serif text-lg font-semibold text-ink"
        >
          <LogoMark />
          AI Book Intelligence
        </Link>
        <div className="flex items-center gap-1">
          <nav aria-label="Разделы" className="hidden md:block">
            <ul className="flex items-center">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-11 items-center rounded-control px-3 text-sm text-ink-2 transition-colors duration-150 hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

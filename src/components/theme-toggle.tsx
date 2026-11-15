"use client";

import { useSyncExternalStore } from "react";
import { getTheme, setTheme, subscribeToTheme, type Theme } from "@/lib/theme";

// На сервере тема неизвестна; после гидрации значение берётся из документа.
const getServerTheme = (): Theme => "light";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getTheme, getServerTheme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "dark" ? "Включить тёмную тему" : "Включить светлую тему"}
      className="inline-flex size-11 cursor-pointer items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
    >
      {/* Какой значок виден, решает CSS по действующей теме — без мигания до гидрации. */}
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="theme-icon-moon size-5 fill-none stroke-current stroke-[1.75]"
      >
        <path
          d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
          strokeLinejoin="round"
        />
      </svg>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="theme-icon-sun size-5 fill-none stroke-current stroke-[1.75]"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
const THEME_EVENT = "abi:theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Выполняется в <head> до первой отрисовки: применяет сохранённый выбор темы.
 * Если выбора нет, атрибут не ставится и тема следует системной настройке (см. tokens.css).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Действующая тема: явный выбор пользователя либо системная настройка. */
export function getTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (isTheme(chosen)) return chosen;
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Хранилище недоступно (например, приватный режим) — тема действует до перезагрузки.
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** Подписка для useSyncExternalStore: смена темы кнопкой, системой или в другой вкладке. */
export function subscribeToTheme(onChange: () => void): () => void {
  const media = window.matchMedia(DARK_QUERY);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    if (isTheme(event.newValue)) document.documentElement.dataset.theme = event.newValue;
    onChange();
  };
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

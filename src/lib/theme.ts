export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME: Theme = "dark";
const THEME_EVENT = "abi:theme-change";

/**
 * Выполняется в <head> до первой отрисовки: применяет сохранённый выбор темы.
 * Если выбора нет, атрибут не ставится и действует основная тема — тёмная (см. tokens.css).
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/** Действующая тема: явный выбор пользователя либо основная. */
export function getTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  return isTheme(chosen) ? chosen : DEFAULT_THEME;
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

/** Подписка для useSyncExternalStore: смена темы кнопкой или в другой вкладке. */
export function subscribeToTheme(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    if (isTheme(event.newValue)) document.documentElement.dataset.theme = event.newValue;
    onChange();
  };
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

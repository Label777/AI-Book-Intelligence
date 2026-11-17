"use client";

import { useEffect, useState } from "react";

type State<T> =
  | { key: string; status: "loading" }
  | { key: string; status: "done"; value: T }
  | { key: string; status: "error"; error: unknown };

/**
 * Загрузка данных в браузере: результат привязан к ключу, поэтому ответ на прежний
 * запрос не подменит нынешний. Пустой ключ — загружать нечего.
 */
export function useAsync<T>(key: string, load: () => Promise<T>): State<T> | null {
  const [state, setState] = useState<State<T> | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load().then(
      (value) => {
        if (!cancelled) setState({ key, status: "done", value });
      },
      (error: unknown) => {
        if (!cancelled) setState({ key, status: "error", error });
      },
    );
    return () => {
      cancelled = true;
    };
    // load намеренно не в зависимостях: он однозначно определяется ключом.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return null;
  return state?.key === key ? state : { key, status: "loading" };
}

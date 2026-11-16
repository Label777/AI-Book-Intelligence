export interface RateLimiterOptions {
  /** Минимальный интервал между началами запросов, мс. */
  minIntervalMs: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ограничитель частоты: запросы выполняются по очереди не чаще, чем раз в minIntervalMs.
 * Возвращает функцию, которая дожидается своей очереди.
 */
export function createRateLimiter(options: RateLimiterOptions): () => Promise<void> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  let nextSlot = 0;

  return async function waitTurn() {
    const current = now();
    const slot = Math.max(current, nextSlot);
    nextSlot = slot + options.minIntervalMs;
    const delay = slot - current;
    if (delay > 0) await sleep(delay);
  };
}

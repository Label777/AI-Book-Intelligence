/**
 * Хранилище кэша. Сейчас — память процесса; когда появится база данных,
 * достаточно написать реализацию этого интерфейса поверх таблицы Postgres.
 */
export interface CacheStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export interface MemoryCacheOptions {
  /** Сколько записей хранить; при переполнении вытесняются давно не читанные. */
  maxEntries?: number;
  /** Источник времени — подменяется в тестах. */
  now?: () => number;
}

export class MemoryCache implements CacheStore {
  private readonly entries = new Map<string, Entry>();
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(options: MemoryCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? 2000;
    this.now = options.now ?? Date.now;
  }

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Перемещаем в конец: Map хранит порядок вставки, первым вытесняется самое старое.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  get size(): number {
    return this.entries.size;
  }
}

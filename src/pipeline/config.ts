/**
 * Настройки AI-пайплайна: лимиты, пороги и выбор моделей.
 * Числа собраны в одном месте, чтобы их можно было менять по результатам замеров.
 */

/** Три уровня моделей: быстрая, основная и самая сильная (docs/03-architecture.md, раздел 2). */
export const MODEL_TIERS = ["fast", "main", "deep"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "claude-haiku-5-5",
  main: "claude-sonnet-5-5",
  deep: "claude-opus-5-5",
};

const MODEL_ENV: Record<ModelTier, string> = {
  fast: "AI_MODEL_FAST",
  main: "AI_MODEL_MAIN",
  deep: "AI_MODEL_DEEP",
};

/** Идентификаторы моделей по уровням; каждый можно переопределить переменной окружения. */
export function resolveModels(
  env: Record<string, string | undefined> = process.env,
): Record<ModelTier, string> {
  const models = { ...DEFAULT_MODELS };
  for (const tier of MODEL_TIERS) {
    const value = env[MODEL_ENV[tier]]?.trim();
    if (value) models[tier] = value;
  }
  return models;
}

export const LIMITS = {
  /** Выдержка из источника: хранится коротко, чтобы не копировать чужой текст большими кусками. */
  excerptMaxChars: 500,
  excerptsPerSource: 6,
  maxSources: 24,
  /** Дословная цитата в утверждении. */
  quoteMaxChars: 200,
  /** Сколько дословных цитат допускается на один анализ. */
  maxQuotes: 8,
  claimMaxChars: 420,
  titleMaxChars: 90,
  actionMaxChars: 240,
  diagramLabelMaxChars: 48,
  /** Сколько раз модель может искать в интернете за один прогон шага «Источники». */
  maxWebSearches: 8,
  /** Сколько раз шаг переспрашивает модель, если ответ не прошёл программные проверки. */
  maxAttempts: 3,
  /** Сколько утверждений проверяется одним вызовом на шаге «Проверка фактов». */
  verifyBatchSize: 12,
  maxSlides: 20,
} as const;

/**
 * Сколько элементов ожидается в разделах: [минимум, цель].
 * Цель взята из ТЗ. Минимум ниже: лучше меньше пунктов, чем повтор одной мысли ради объёма.
 */
export const COUNTS = {
  themes: [3, 7],
  ideas: [5, 10],
  concepts: [1, 5],
  insights: [5, 10],
  beliefs: [2, 5],
  takeaways: [5, 10],
} as const;

/** Пороги похожести текстов (коэффициент Дайса по триграммам символов). */
export const SIMILARITY = {
  /** Выше — тексты считаются повтором без дополнительной проверки. */
  duplicate: 0.72,
  /** Названия глав из двух источников считаются одной и той же главой. */
  sameChapter: 0.8,
  /** Доля совпавших глав, при которой оглавление считается подтверждённым. */
  tocAgreement: 0.8,
} as const;

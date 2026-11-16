/**
 * Проверка конкретности действий (docs/05-focus-and-mvp.md, раздел 2.1):
 * у действия есть объект и условие, формулировка — шаг, а не совет общего вида.
 */
import { LIMITS } from "../config";
import type { ActionDraft } from "../schema";
import { normalizeLoose } from "../text";

/** Начала фраз, по которым узнаётся совет общего вида. */
const VAGUE_OPENERS = [
  "старайтесь",
  "постарайтесь",
  "попробуйте быть",
  "будьте",
  "помните",
  "не забывайте",
  "задумайтесь",
  "подумайте о том",
  "осознайте",
  "важно",
  "нужно",
  "следует",
  "стоит",
  "try to be",
  "be more",
  "remember",
  "think about",
  "keep in mind",
  "it is important",
];

const MIN_ACTION_CHARS = 25;

export function checkAction(action: ActionDraft): string[] {
  const problems: string[] = [];
  const text = action.text.trim();
  const loose = normalizeLoose(text);

  if (text.length < MIN_ACTION_CHARS) {
    problems.push("Действие слишком короткое, чтобы быть конкретным шагом.");
  }
  if (text.length > LIMITS.actionMaxChars) {
    problems.push(`Действие длиннее ${LIMITS.actionMaxChars} символов.`);
  }
  if (normalizeLoose(action.object).length < 3) {
    problems.push("Не указан объект действия.");
  }
  if (normalizeLoose(action.when).length < 3) {
    problems.push("Не указано, когда или при каком условии выполнять действие.");
  }
  if (
    VAGUE_OPENERS.some((opener) => loose === opener || loose.startsWith(`${opener} `))
  ) {
    problems.push("Формулировка — совет общего вида, а не конкретный шаг.");
  }
  return problems;
}

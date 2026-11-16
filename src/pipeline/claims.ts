/**
 * Реестр утверждений одного анализа.
 * Модель возвращает черновики с локальными метками; реестр выдаёт им постоянные
 * идентификаторы и переводит ссылки между черновиками в ссылки между утверждениями.
 */
import type { Claim, ClaimInput } from "./schema";

export class ClaimRegistry {
  private readonly claims: Claim[];
  private counter: number;

  constructor(existing: Claim[] = []) {
    this.claims = [...existing];
    this.counter = existing.reduce((max, claim) => {
      const n = Number(/^c(\d+)$/.exec(claim.id)?.[1] ?? 0);
      return Math.max(max, n);
    }, 0);
  }

  all(): Claim[] {
    return [...this.claims];
  }

  get(id: string): Claim | undefined {
    return this.claims.find((claim) => claim.id === id);
  }

  /**
   * Добавляет черновики одного ответа модели. Возвращает соответствие «метка → идентификатор».
   * Ссылка `basedOn` разрешается сначала как метка из этого же ответа, затем как идентификатор
   * уже сохранённого утверждения; неразрешённые ссылки остаются как есть — их найдёт проверка
   * привязки (checks/claims.ts).
   */
  add(drafts: ClaimInput[]): Map<string, string> {
    const keyToId = new Map<string, string>();
    const created: Claim[] = [];
    for (const draft of drafts) {
      const id = `c${++this.counter}`;
      if (draft.key && !keyToId.has(draft.key)) keyToId.set(draft.key, id);
      created.push({
        id,
        type: draft.type,
        text: draft.text.trim(),
        evidence: draft.evidence,
        basedOn: draft.basedOn,
        quote: draft.quote,
        verification: "unverified",
        downgradedFrom: null,
      });
    }
    for (const claim of created) {
      claim.basedOn = [...new Set(claim.basedOn.map((ref) => keyToId.get(ref) ?? ref))];
      this.claims.push(claim);
    }
    return keyToId;
  }

  /** Убирает утверждения — например, если ответ модели не прошёл проверку и будет запрошен заново. */
  remove(ids: Iterable<string>): void {
    const drop = new Set(ids);
    for (let i = this.claims.length - 1; i >= 0; i--) {
      if (drop.has(this.claims[i].id)) this.claims.splice(i, 1);
    }
  }
}

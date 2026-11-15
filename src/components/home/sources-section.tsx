import { ProvenanceLabel } from "@/components/ui/provenance-label";
import { PROVENANCE, PROVENANCE_TYPES } from "@/lib/provenance";

const modes = [
  {
    name: "По полному тексту",
    text: "Вы загружаете свой файл книги — EPUB, PDF или TXT. Факты привязаны к главам, цитаты сверяются с текстом.",
  },
  {
    name: "По открытым источникам",
    text: "Текста книги у нас нет. Анализ строится на описаниях, оглавлении, рецензиях и интервью, а пределы точности указаны прямо в презентации.",
  },
];

const rules = [
  "Нет подтверждённого оглавления — нет разбора по главам.",
  "Нет точного совпадения с текстом — нет цитаты.",
  "Оценки AI подписаны как оценки AI, а не научный рейтинг.",
];

export function SourcesSection() {
  return (
    <section
      id="sources"
      aria-labelledby="sources-title"
      className="scroll-mt-8 border-t border-line"
    >
      <div className="mx-auto max-w-page px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <div className="flex flex-col gap-4">
            <h2 id="sources-title" className="text-title">
              Как мы работаем с источниками
            </h2>
            <p className="max-w-[60ch] text-lg text-ink-2">
              AI может ошибаться и додумывать. Поэтому мы не просим верить на слово: тип
              каждого утверждения хранится в данных и виден в интерфейсе, а источник
              открывается в один клик.
            </p>
          </div>

          <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {PROVENANCE_TYPES.map((type) => (
              <div key={type} className="flex flex-col items-start gap-2">
                <dt>
                  <ProvenanceLabel type={type} />
                </dt>
                <dd className="text-ink-2">{PROVENANCE[type].description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <h3 className="mt-16 text-heading">Два режима анализа</h3>
        <p className="mt-2 max-w-[70ch] text-ink-2">
          Режим всегда виден в шапке презентации — вы знаете, на чём основан разбор.
        </p>
        <ul className="mt-6 grid gap-6 md:grid-cols-2">
          {modes.map((mode) => (
            <li
              key={mode.name}
              className="flex flex-col items-start gap-3 rounded-card border border-line bg-surface p-6 shadow-card"
            >
              <span className="rounded-full bg-surface-2 px-3 py-1 text-label text-ink">
                {mode.name}
              </span>
              <p className="text-ink-2">{mode.text}</p>
            </li>
          ))}
        </ul>

        <h3 className="mt-16 text-heading">Чего мы не делаем</h3>
        <ul className="mt-6 grid gap-4 md:grid-cols-3">
          {rules.map((rule) => (
            <li key={rule} className="border-l-2 border-accent pl-4 text-ink">
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

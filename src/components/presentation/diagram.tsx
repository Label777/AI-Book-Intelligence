import type { Diagram } from "@/pipeline/schema";

type Item = Diagram["items"][number];

function Node({ item, index }: { item: Item; index?: number }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 rounded-control border border-line bg-surface-2 px-3 py-2.5">
      <span className="flex items-baseline gap-2 font-medium wrap-anywhere">
        {index !== undefined ? (
          <span className="text-label-sm text-accent">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : null}
        {item.label}
      </span>
      {item.note ? (
        <span className="text-sm wrap-anywhere text-ink-2">{item.note}</span>
      ) : null}
    </div>
  );
}

function Arrow() {
  return (
    <span aria-hidden="true" className="shrink-0 self-center text-ink-2 max-md:rotate-90">
      →
    </span>
  );
}

/** Поток и цикл: шаги со стрелками; на телефоне — столбиком. */
function Steps({ items, cycle }: { items: Item[]; cycle: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-2 md:flex-row md:items-stretch">
        {items.map((item, index) => (
          <li key={index} className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row">
            <Node item={item} index={index} />
            {index < items.length - 1 ? <Arrow /> : null}
          </li>
        ))}
      </ol>
      {cycle ? (
        <p className="text-label-sm text-ink-2">
          ↻ После последнего шага цикл начинается заново
        </p>
      ) : null}
    </div>
  );
}

/** Пирамида: первый элемент — вершина, каждый следующий уровень шире. */
function Pyramid({ items }: { items: Item[] }) {
  return (
    <ol className="flex flex-col items-center gap-2">
      {items.map((item, index) => (
        <li
          key={index}
          className="flex w-full justify-center"
          style={{
            maxWidth: `${Math.round(45 + (55 * index) / Math.max(1, items.length - 1))}%`,
          }}
        >
          <div className="w-full rounded-control border border-line bg-surface-2 px-3 py-2.5 text-center max-sm:min-w-56">
            <span className="font-medium wrap-anywhere">{item.label}</span>
            {item.note ? (
              <span className="block text-sm wrap-anywhere text-ink-2">{item.note}</span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Матрица 2 × 2 с подписями осей. */
function Matrix({ items, axes }: { items: Item[]; axes: string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-label-sm text-ink-2">
        ↕ {axes[1]} · ↔ {axes[0]}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {items.map((item, index) => (
          <li key={index} className="flex">
            <Node item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Сравнение: таблица, названия колонок — из осей. */
function Comparison({ items, axes }: { items: Item[]; axes: string[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            {axes.slice(0, 2).map((axis) => (
              <th
                key={axis}
                scope="col"
                className="border-b border-line-strong px-3 py-2 text-label"
              >
                {axis}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <th
                scope="row"
                className="border-b border-line px-3 py-2.5 align-top font-medium"
              >
                {item.label}
              </th>
              <td className="border-b border-line px-3 py-2.5 align-top text-ink-2">
                {item.note ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Дерево: корень — название схемы, ветви — элементы. */
function Tree({ title, items }: { title: string; items: Item[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="self-start rounded-control border border-accent px-3 py-2 font-medium">
        {title}
      </div>
      <ul className="ml-4 flex flex-col gap-2 border-l border-line-strong pl-4">
        {items.map((item, index) => (
          <li key={index} className="flex">
            <Node item={item} />
          </li>
        ))}
      </ul>
    </div>
  );
}

const TYPE_NAMES: Record<Diagram["type"], string> = {
  cycle: "Цикл",
  pyramid: "Пирамида",
  matrix: "Матрица",
  flow: "Последовательность",
  comparison: "Сравнение",
  tree: "Структура",
};

/** Схема концепции. Тип и подписи выбирает модель, рисует интерфейс. */
export function DiagramView({ diagram }: { diagram: Diagram }) {
  const { type, items, axes, title } = diagram;
  return (
    <figure
      data-diagram={type}
      className="flex flex-col gap-3 rounded-card border border-line p-4"
    >
      <figcaption className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-label-sm text-ink-2">Схема · {TYPE_NAMES[type]}</span>
        {type !== "tree" ? <span className="font-medium">{title}</span> : null}
      </figcaption>
      {type === "flow" || type === "cycle" ? (
        <Steps items={items} cycle={type === "cycle"} />
      ) : null}
      {type === "pyramid" ? <Pyramid items={items} /> : null}
      {type === "matrix" ? <Matrix items={items} axes={axes} /> : null}
      {type === "comparison" ? <Comparison items={items} axes={axes} /> : null}
      {type === "tree" ? <Tree title={title} items={items} /> : null}
    </figure>
  );
}

// Печатает итог живой проверки поиска. В GitHub Actions строки «::notice» и «::error»
// становятся аннотациями к запуску, так что итог виден без чтения журнала.
import { existsSync, readFileSync } from "node:fs";

if (!existsSync("search-eval.json")) {
  console.log("::error title=Проверка поиска::Отчёт search-eval.json не создан");
  process.exit(1);
}

const report = JSON.parse(readFileSync("search-eval.json", "utf8"));
const percent = Math.round(report.rate * 100);
const clean = (text) =>
  String(text)
    .replace(/[\r\n]+/g, " ")
    .replace(/::/g, ":");

const byKind = {};
for (const row of report.rows) {
  byKind[row.kind] ??= { hits: 0, total: 0 };
  byKind[row.kind].total += 1;
  if (row.ok) byKind[row.kind].hits += 1;
}
const kinds = Object.entries(byKind)
  .map(([kind, value]) => `${kind} ${value.hits}/${value.total}`)
  .join("; ");
const strategies = {};
for (const row of report.rows)
  strategies[row.strategy ?? "ошибка"] = (strategies[row.strategy ?? "ошибка"] ?? 0) + 1;

console.log(
  `::notice title=Проверка поиска::В первой тройке ${report.hits} из ${report.total} (${percent} %). ${clean(kinds)}. Способы: ${clean(JSON.stringify(strategies))}`,
);
console.log(`::notice title=Страница книги::${clean(JSON.stringify(report.book))}`);

const misses = report.rows.filter((row) => !row.ok);
// У аннотаций есть лимит на шаг, поэтому промахи собираем в несколько сообщений.
for (let index = 0; index < misses.length; index += 4) {
  const chunk = misses
    .slice(index, index + 4)
    .map(
      (row) =>
        `«${row.query}» [${row.strategy ?? "-"}, место ${row.position ?? "нет"}]${row.error ? ` ОШИБКА ${row.error}` : ""} → ${row.top.join(" | ") || "пусто"}`,
    )
    .join(" ;; ");
  console.log(
    `::warning title=Промахи ${index + 1}–${Math.min(index + 4, misses.length)}::${clean(chunk)}`,
  );
}

for (const row of report.rows) {
  console.log(
    `${row.ok ? "✓" : "✗"} ${row.kind} | ${row.query} | ${row.strategy} | ${row.top[0] ?? "—"}`,
  );
}

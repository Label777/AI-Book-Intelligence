// Итог прогона AI-движка на настоящей модели — в аннотации GitHub Actions.
import { existsSync, readFileSync } from "node:fs";

const clean = (text) =>
  String(text ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/::/g, ":");
const file = "evals/out/summary.json";

if (!existsSync(file)) {
  console.log(
    "::error title=Прогон AI-движка::Итог не создан: прогон упал до первой книги. Подробности — в журнале шага.",
  );
  process.exit(0);
}

for (const row of JSON.parse(readFileSync(file, "utf8"))) {
  const level = row.status === "completed" && row.publishable ? "notice" : "warning";
  const parts = [
    `статус ${row.status}${row.stoppedAt ? ` на шаге ${row.stoppedAt}` : ""}`,
    row.reason ? `причина: ${row.reason}` : null,
    `покрытие ${row.coverage ?? "—"}, оглавление ${row.tocVerified ? "подтверждено" : "не подтверждено"}`,
    row.slides !== undefined
      ? `слайдов ${row.slides}; фактов проверено ${row.checked}, подтверждено ${row.supported}, понижено ${row.downgraded}, удалено ${row.removed}+${row.cascaded}; цитат ${row.quotes}; публикуемо: ${row.publishable ? "да" : "нет"}`
      : null,
    row.missingSections?.length
      ? `пустые разделы: ${row.missingSections.join(", ")}`
      : null,
    row.reasons?.length ? `почему не публикуемо: ${row.reasons.join("; ")}` : null,
    `вызовов ${row.calls}, токены: вход ${row.inputTokens}, выход ${row.outputTokens}, кэш ${row.cacheReadTokens}/${row.cacheWriteTokens}; поисков ${row.webSearches}; ${row.seconds} с`,
    row.model
      ? `модели: ${row.model.fast} / ${row.model.main} / ${row.model.deep}`
      : null,
  ].filter(Boolean);
  console.log(`::${level} title=${clean(row.book)}::${clean(parts.join(" | "))}`);
  for (const warning of (row.warnings ?? []).slice(0, 5)) {
    console.log(`::warning title=${clean(row.book)} — замечание::${clean(warning)}`);
  }
}

// Итог проверки выложенного сайта — в аннотации GitHub Actions.
import { existsSync, readFileSync } from "node:fs";

const clean = (text) =>
  String(text ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/::/g, ":");
if (!existsSync("live-check.json")) {
  console.log("::warning title=Выложенный сайт::Проверка не дала отчёта");
  process.exit(0);
}
const report = JSON.parse(readFileSync("live-check.json", "utf8"));
const level = report.error ? "warning" : "notice";
console.log(
  `::${level} title=Выложенный сайт::${clean(
    [
      `поиск: ${report.searchStatus ?? "—"}`,
      `результаты: ${(report.searchTitles ?? []).slice(0, 3).join(" | ") || "—"}`,
      `книга: ${report.bookTitle ?? "—"} (${report.bookMeta ?? "—"})`,
      `найдено в библиотеках: ${(report.found ?? []).join(" ; ") || "ничего"}`,
      `ссылок на поиск: ${report.searchLinks ?? "—"}`,
      `обложка загрузилась: ${report.coverLoaded ? "да" : "нет"}`,
      report.error ? `ОШИБКА: ${report.error}` : null,
    ]
      .filter(Boolean)
      .join(" || "),
  )}`,
);
if (report.failedRequests?.length) {
  console.log(
    `::warning title=Запросы, которые не прошли::${clean(report.failedRequests.join(" ; "))}`,
  );
}

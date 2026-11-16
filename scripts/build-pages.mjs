// Статическая сборка сайта для GitHub Pages.
//
// У статического сайта нет сервера, поэтому серверные страницы (поиск, книга, анализ)
// заменяются вариантами из pages-site/, которые ходят в каталог прямо из браузера.
// Сборка идёт в копии проекта (.pages-build), исходники не меняются. Результат — в out/.
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const work = path.join(root, ".pages-build");
const basePath = process.env.PAGES_BASE_PATH ?? "/AI-Book-Intelligence";

rmSync(work, { recursive: true, force: true });
mkdirSync(work);
for (const entry of [
  "src",
  "pages-site",
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "postcss.config.mjs",
]) {
  if (existsSync(path.join(root, entry))) {
    cpSync(path.join(root, entry), path.join(work, entry), { recursive: true });
  }
}
if (existsSync(path.join(root, "public"))) {
  cpSync(path.join(root, "public"), path.join(work, "public"), { recursive: true });
}
symlinkSync(path.join(root, "node_modules"), path.join(work, "node_modules"), "dir");

// Серверные страницы — прочь, на их место статические.
for (const route of ["search", "book", "analysis"]) {
  rmSync(path.join(work, "src/app", route), { recursive: true, force: true });
}
cpSync(path.join(work, "pages-site/app"), path.join(work, "src/app"), {
  recursive: true,
});
rmSync(path.join(work, "pages-site"), { recursive: true });

execSync("npx next build", {
  cwd: work,
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_STATIC_SITE: "1", PAGES_BASE_PATH: basePath },
});

rmSync(path.join(root, "out"), { recursive: true, force: true });
cpSync(path.join(work, "out"), path.join(root, "out"), { recursive: true });
// Без этого файла GitHub Pages не отдаёт каталоги, начинающиеся с подчёркивания (_next).
writeFileSync(path.join(root, "out/.nojekyll"), "");
rmSync(work, { recursive: true, force: true });
console.log(`Готово: out/ (базовый путь «${basePath}»)`);

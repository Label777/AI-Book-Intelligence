// Отдаёт статическую сборку из out/ так же, как GitHub Pages: под базовым путём,
// с index.html для каталогов и 404.html для неизвестных адресов.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve("out");
const base = process.env.PAGES_BASE_PATH ?? "/AI-Book-Intelligence";
const port = Number(process.env.PORT ?? 3200);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let file = null;
  if (url.pathname.startsWith(base)) {
    const relative = decodeURIComponent(url.pathname.slice(base.length)) || "/";
    const target = path.join(root, relative);
    if (target.startsWith(root)) {
      if (existsSync(target) && statSync(target).isFile()) file = target;
      else if (existsSync(path.join(target, "index.html")))
        file = path.join(target, "index.html");
    }
  }
  const status = file ? 200 : 404;
  file ??= path.join(root, "404.html");
  response.writeHead(status, {
    "content-type": TYPES[path.extname(file)] ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
}).listen(port, "127.0.0.1", () =>
  console.log(`static site on http://127.0.0.1:${port}${base}/`),
);

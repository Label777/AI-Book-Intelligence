// Заглушка Open Library и Google Books для сценарных тестов: отвечает записанными ответами
// и считает запросы, чтобы тест мог проверить работу кэша.
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const fixtures = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/openlibrary");
const load = (name) => readFileSync(join(fixtures, name), "utf8");
const port = Number(process.env.MOCK_CATALOG_PORT ?? 3101);

/** @type {Record<string, number>} */
let requests = {};

function searchFixture(q) {
  const text = q.toLowerCase();
  if (text.startsWith("key:/works/ol17075811w")) return "search-key-sapiens.json";
  if (text.startsWith("key:")) return "search-empty.json";
  if (text.includes("philosopher")) return "search-potter.json";
  if (text.includes("atomic habits")) return "search-atomic.json";
  if (text.includes("sapiens") || text === "harari") return "search-sapiens.json";
  if (text.includes("мастер")) return "search-master.json";
  if (text.includes("gift")) return "search-gift.json";
  return "search-empty.json";
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
  const send = (status, body) => {
    // Настоящие каталоги разрешают запросы из браузера с любого сайта — заглушка тоже.
    response.writeHead(status, {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    });
    response.end(body);
  };

  if (url.pathname === "/__health") return send(200, "{}");
  if (url.pathname === "/__requests") return send(200, JSON.stringify(requests));
  if (url.pathname === "/__reset") {
    requests = {};
    return send(200, "{}");
  }

  const key =
    url.pathname === "/search.json"
      ? `search:${url.searchParams.get("q")}`
      : url.pathname;
  requests[key] = (requests[key] ?? 0) + 1;

  if (url.pathname === "/search.json") {
    const q = url.searchParams.get("q") ?? "";
    if (q.toLowerCase().includes("catalogdown")) return send(503, "{}");
    return send(200, load(searchFixture(q)));
  }
  if (url.pathname === "/works/OL17075811W.json")
    return send(200, load("work-OL17075811W.json"));
  if (url.pathname === "/works/OL17075811W/editions.json") {
    return send(200, load("editions-OL17075811W.json"));
  }
  if (url.pathname === "/authors/OL3778242A.json")
    return send(200, load("author-OL3778242A.json"));
  if (url.pathname === "/works/OL503W.json") return send(503, "{}");

  // Wikidata: переводит «Атомные привычки» в «Atomic Habits» и называет автора.
  if (url.pathname === "/w/api.php") {
    const action = url.searchParams.get("action");
    if (action === "wbsearchentities") {
      const found = (url.searchParams.get("search") ?? "").includes("атомные");
      return send(
        200,
        JSON.stringify({ search: found ? [{ id: "Q100" }, { id: "Q101" }] : [] }),
      );
    }
    if (url.searchParams.get("ids") === "Q100|Q101") {
      return send(
        200,
        JSON.stringify({
          entities: {
            // Первая находка — не книга (нет автора), вторая — книга.
            Q100: { labels: { en: { value: "Atomic Habits (film)" } }, claims: {} },
            Q101: {
              labels: { en: { value: "Atomic Habits" } },
              claims: { P50: [{ mainsnak: { datavalue: { value: { id: "Q102" } } } }] },
            },
          },
        }),
      );
    }
    if (url.searchParams.get("ids") === "Q102") {
      return send(
        200,
        JSON.stringify({
          entities: { Q102: { labels: { en: { value: "James Clear" } } } },
        }),
      );
    }
    return send(200, "{}");
  }

  // Project Gutenberg (каталог Gutendex): «Sapiens» там нет, «Мастер и Маргарита» — тоже.
  if (url.pathname === "/books" || url.pathname === "/books/") {
    const search = (url.searchParams.get("search") ?? "").toLowerCase();
    if (search.includes("pride")) {
      return send(
        200,
        JSON.stringify({
          results: [
            {
              id: 1342,
              title: "Pride and Prejudice",
              authors: [{ name: "Austen, Jane" }],
            },
          ],
        }),
      );
    }
    return send(200, JSON.stringify({ count: 0, results: [] }));
  }

  // Google Books: исправляет опечатку в «garry poter».
  if (url.pathname === "/books/v1/volumes") {
    const q = (url.searchParams.get("q") ?? "").toLowerCase();
    if (q.includes("intitle:") && q.includes("sapiens")) {
      return send(
        200,
        JSON.stringify({
          items: [
            {
              volumeInfo: {
                title: "Sapiens",
                authors: ["Yuval Noah Harari"],
                previewLink:
                  "http://books.google.com/books?id=FmyBAwAAQBAJ&printsec=frontcover",
              },
              accessInfo: { viewability: "PARTIAL" },
            },
          ],
        }),
      );
    }
    if (q.includes("poter")) {
      return send(
        200,
        JSON.stringify({
          items: [
            {
              volumeInfo: {
                title: "Harry Potter and the Philosopher's Stone",
                authors: ["J. K. Rowling"],
              },
            },
          ],
        }),
      );
    }
    return send(200, "{}");
  }

  return send(404, '{"error":"notfound"}');
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock catalog on http://127.0.0.1:${port}`);
});

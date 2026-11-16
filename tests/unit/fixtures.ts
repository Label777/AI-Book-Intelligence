import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { CatalogClient } from "@/books/openlibrary/client";

export function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "tests/fixtures/openlibrary", name), "utf8"),
  );
}

/** Клиент каталога, который отвечает по таблице «начало пути → ответ» и запоминает запросы. */
export function fakeClient(routes: [match: (path: string) => boolean, body: unknown][]) {
  const paths: string[] = [];
  const client: CatalogClient = {
    async getJson(path) {
      paths.push(path);
      const route = routes.find(([match]) => match(path));
      if (!route) return null;
      if (route[1] instanceof Error) throw route[1];
      return route[1];
    },
  };
  return { client, paths };
}

/** q из пути поискового запроса. */
export function queryOf(path: string): string {
  return new URL(path, "https://example.org").searchParams.get("q") ?? "";
}

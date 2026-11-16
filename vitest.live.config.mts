import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Контрольные прогоны на настоящей модели (evals/). В обычный `npm run test` не входят. */
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.live.test.ts"],
  },
});

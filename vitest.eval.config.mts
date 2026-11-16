import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Живая проверка поиска против настоящего каталога. Запускается отдельно: npm run eval:search
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/eval/**/*.eval.ts"],
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Сборка данных для сценарных тестов: npm run fixtures:analysis
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { environment: "node", include: ["tests/fixtures/**/*.fixture.ts"] },
});

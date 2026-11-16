// Копирует готовые анализы для сценарных тестов во временный каталог:
// приложение читает их оттуда и может дописывать, не трогая исходные данные.
import { cpSync, rmSync } from "node:fs";

const target = process.env.ANALYSIS_STORE_DIR ?? ".e2e-store";
rmSync(target, { recursive: true, force: true });
cpSync("tests/fixtures/analysis", target, { recursive: true });
console.log(`analysis store prepared in ${target}`);

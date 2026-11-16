import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  // Часть тестов идёт без браузерного окружения (серверный код).
  if (typeof document === "undefined") return;
  cleanup();
  document.documentElement.removeAttribute("data-theme");
  localStorage.clear();
});

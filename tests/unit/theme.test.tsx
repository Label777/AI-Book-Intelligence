import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTheme, setTheme, themeInitScript, THEME_STORAGE_KEY } from "@/lib/theme";

type Listener = () => void;

/** jsdom не знает о системной теме — подставляем управляемую заглушку matchMedia. */
function mockSystemTheme(initial: "light" | "dark") {
  let dark = initial === "dark";
  const listeners = new Set<Listener>();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
    })),
  );
  return {
    set(value: "light" | "dark") {
      dark = value === "dark";
      listeners.forEach((listener) => listener());
    },
  };
}

const runInitScript = () => new Function(themeInitScript)();

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("тема", () => {
  it("без выбора пользователя следует системной настройке", () => {
    mockSystemTheme("dark");
    expect(getTheme()).toBe("dark");
    mockSystemTheme("light");
    expect(getTheme()).toBe("light");
  });

  it("выбор пользователя важнее системной настройки и сохраняется", () => {
    mockSystemTheme("dark");
    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("скрипт в <head> применяет сохранённую тему до отрисовки", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    runInitScript();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("скрипт не ставит атрибут, если выбора нет или значение испорчено", () => {
    runInitScript();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    localStorage.setItem(THEME_STORAGE_KEY, "<img onerror=alert(1)>");
    runInitScript();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("скрипт не падает, когда хранилище недоступно", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(runInitScript).not.toThrow();
    getItem.mockRestore();
  });
});

describe("ThemeToggle", () => {
  it("переключает тему туда и обратно, подпись говорит, что произойдёт", async () => {
    mockSystemTheme("light");
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Включить тёмную тему" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: "Включить светлую тему" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("реагирует на смену системной темы, пока пользователь не выбрал сам", () => {
    const system = mockSystemTheme("light");
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Включить тёмную тему" }),
    ).toBeInTheDocument();

    act(() => system.set("dark"));
    expect(
      screen.getByRole("button", { name: "Включить светлую тему" }),
    ).toBeInTheDocument();
  });
});

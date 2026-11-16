import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";
import { getTheme, setTheme, themeInitScript, THEME_STORAGE_KEY } from "@/lib/theme";

const runInitScript = () => new Function(themeInitScript)();

describe("тема", () => {
  it("по умолчанию тёмная", () => {
    expect(getTheme()).toBe("dark");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("выбор пользователя применяется и сохраняется", () => {
    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("скрипт в <head> применяет сохранённую тему до отрисовки", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    runInitScript();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("скрипт не ставит атрибут, если выбора нет или значение испорчено", () => {
    runInitScript();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

    localStorage.setItem(THEME_STORAGE_KEY, "<img onerror=alert(1)>");
    runInitScript();
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(getTheme()).toBe("dark");
  });

  it("скрипт не падает, когда хранилище недоступно", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(runInitScript).not.toThrow();
    getItem.mockRestore();
  });

  it("тема применяется, даже если сохранить выбор не удалось", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => setTheme("light")).not.toThrow();
    expect(getTheme()).toBe("light");
    setItem.mockRestore();
  });
});

describe("ThemeToggle", () => {
  it("переключает тему туда и обратно, подпись говорит, что произойдёт", async () => {
    render(<ThemeToggle />);

    await userEvent.click(screen.getByRole("button", { name: "Включить светлую тему" }));
    expect(document.documentElement.dataset.theme).toBe("light");

    await userEvent.click(screen.getByRole("button", { name: "Включить тёмную тему" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("показывает сохранённый выбор", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);
    expect(
      screen.getByRole("button", { name: "Включить тёмную тему" }),
    ).toBeInTheDocument();
  });
});

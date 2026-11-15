import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchForm } from "@/components/search-form";

describe("SearchForm", () => {
  it("отправляет запрос методом GET на /search в параметре q", () => {
    render(<SearchForm />);
    const form = screen.getByRole("search", { name: "Поиск книги" });
    expect(form).toHaveAttribute("action", "/search");
    expect(form).not.toHaveAttribute("method", "post");
    expect(
      screen.getByRole("searchbox", { name: "Название книги и автор" }),
    ).toHaveAttribute("name", "q");
    expect(screen.getByRole("button", { name: "Создать анализ" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("не принимает пустой запрос и запрос из одних пробелов", () => {
    render(<SearchForm />);
    const input = screen.getByRole<HTMLInputElement>("searchbox");
    expect(input).toBeRequired();
    expect(input).toBeInvalid();

    const pattern = new RegExp(`^(?:${input.pattern})$`, "v");
    expect(pattern.test("   ")).toBe(false);
    expect(pattern.test(" Сапиенс ")).toBe(true);
  });

  it("подставляет прежний запрос", () => {
    render(<SearchForm defaultValue="Сапиенс Харари" />);
    expect(screen.getByRole("searchbox")).toHaveValue("Сапиенс Харари");
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TextField } from "@/components/ui/text-field";

describe("TextField", () => {
  it("связывает подпись с полем", async () => {
    render(<TextField label="Название книги" />);
    const input = screen.getByLabelText("Название книги");
    await userEvent.type(input, "Сапиенс");
    expect(input).toHaveValue("Сапиенс");
  });

  it("скрытая подпись остаётся доступной экранному диктору", () => {
    render(<TextField label="Поиск" hideLabel />);
    expect(screen.getByRole("textbox", { name: "Поиск" })).toBeInTheDocument();
    expect(screen.getByText("Поиск")).toHaveClass("sr-only");
  });

  it("подсказка и ошибка привязаны через aria-describedby", () => {
    render(<TextField label="Автор" hint="Можно фамилию" error="Обязательное поле" />);
    const input = screen.getByLabelText("Автор");
    expect(input).toHaveAccessibleDescription("Можно фамилию Обязательное поле");
    expect(input).toBeInvalid();
  });

  it("без ошибки поле не помечено как неверное", () => {
    render(<TextField label="Автор" />);
    const input = screen.getByLabelText("Автор");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("у двух полей разные идентификаторы", () => {
    render(
      <>
        <TextField label="Первое" />
        <TextField label="Второе" />
      </>,
    );
    expect(screen.getByLabelText("Первое").id).not.toBe(
      screen.getByLabelText("Второе").id,
    );
  });
});

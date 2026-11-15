import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, buttonClasses } from "@/components/ui/button";

describe("Button", () => {
  it("по умолчанию не отправляет форму", () => {
    render(<Button>Сохранить</Button>);
    expect(screen.getByRole("button", { name: "Сохранить" })).toHaveAttribute(
      "type",
      "button",
    );
  });

  it("вызывает обработчик по клику", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Дальше</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Дальше" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("в отключённом состоянии не реагирует на клик", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Дальше
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Дальше" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("любой размер не ниже 44 px (min-h-11 и больше)", () => {
    expect(buttonClasses("primary", "md")).toContain("min-h-11");
    expect(buttonClasses("primary", "lg")).toContain("min-h-14");
  });

  it("варианты отличаются оформлением", () => {
    const all = (["primary", "secondary", "ghost"] as const).map((v) => buttonClasses(v));
    expect(new Set(all).size).toBe(3);
  });
});

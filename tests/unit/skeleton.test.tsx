import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookCardSkeleton, Skeleton, SkeletonText } from "@/components/ui/skeleton";

describe("Skeleton", () => {
  it("скрыт от экранного диктора", () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstChild).toHaveClass("h-4", "w-10");
  });

  it("SkeletonText рисует заданное число строк, последняя короче", () => {
    const { container } = render(<SkeletonText lines={4} />);
    const lines = container.querySelectorAll("[data-skeleton]");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toHaveClass("w-3/5");
    expect(lines[0]).toHaveClass("w-full");
  });

  it("BookCardSkeleton сообщает о загрузке", () => {
    render(<BookCardSkeleton />);
    expect(screen.getByRole("status")).toHaveTextContent("Загрузка…");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BookCard } from "@/components/ui/book-card";

const book = {
  title: "Sapiens: Краткая история человечества",
  authors: ["Юваль Ной Харари"],
  href: "/book/OL17075811W",
};

describe("BookCard", () => {
  it("ведёт на страницу книги и называет её", () => {
    render(<BookCard {...book} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/book/OL17075811W");
    expect(screen.getByRole("heading", { name: book.title })).toBeInTheDocument();
    expect(link).toHaveTextContent("Юваль Ной Харари");
  });

  it("показывает год и число изданий с правильным окончанием", () => {
    const { rerender } = render(<BookCard {...book} year={2011} editionCount={1} />);
    expect(screen.getByText("2011 · 1 издание")).toBeInTheDocument();
    rerender(<BookCard {...book} year={2011} editionCount={3} />);
    expect(screen.getByText("2011 · 3 издания")).toBeInTheDocument();
    rerender(<BookCard {...book} year={2011} editionCount={25} />);
    expect(screen.getByText("2011 · 25 изданий")).toBeInTheDocument();
  });

  it("без года и изданий строка сведений не выводится", () => {
    render(<BookCard {...book} />);
    expect(screen.queryByText(/издани/)).not.toBeInTheDocument();
  });

  it("без обложки рисует типографическую, с обложкой — изображение", () => {
    const { container, rerender } = render(<BookCard {...book} />);
    expect(container.querySelector('[data-cover="typographic"]')).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();

    rerender(<BookCard {...book} coverUrl="https://covers.example/1.jpg" />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://covers.example/1.jpg",
    );
    expect(container.querySelector('[data-cover="typographic"]')).not.toBeInTheDocument();
  });

  it("перечисляет нескольких авторов через запятую", () => {
    render(
      <BookCard
        {...book}
        coverUrl="https://covers.example/1.jpg"
        authors={["А. Стругацкий", "Б. Стругацкий"]}
      />,
    );
    expect(screen.getByText("А. Стругацкий, Б. Стругацкий")).toBeInTheDocument();
  });
});

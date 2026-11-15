import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProvenanceLabel } from "@/components/ui/provenance-label";
import { PROVENANCE, PROVENANCE_TYPES } from "@/lib/provenance";

describe("ProvenanceLabel", () => {
  it.each(PROVENANCE_TYPES)(
    "%s: показывает подпись и полное название для диктора",
    (type) => {
      const { container } = render(<ProvenanceLabel type={type} />);
      const label = container.querySelector(`[data-provenance="${type}"]`);
      expect(label).toHaveTextContent(PROVENANCE[type].label);
      expect(label?.querySelector(".sr-only")).toHaveTextContent(PROVENANCE[type].name);
    },
  );

  it("типы различаются формой, подписью и цветом — не только цветом", () => {
    const rendered = PROVENANCE_TYPES.map((type) => {
      const { container } = render(<ProvenanceLabel type={type} />);
      const label = container.querySelector(`[data-provenance="${type}"]`)!;
      return {
        shape: label.querySelector("svg")!.getAttribute("data-shape"),
        text: PROVENANCE[type].label,
        color: [...label.classList].find((name) => name.startsWith("text-src-")),
      };
    });
    expect(new Set(rendered.map((item) => item.shape)).size).toBe(4);
    expect(new Set(rendered.map((item) => item.text)).size).toBe(4);
    expect(new Set(rendered.map((item) => item.color)).size).toBe(4);
  });

  it("идентификаторы типов совпадают с полем claims.type из архитектуры", () => {
    expect([...PROVENANCE_TYPES]).toEqual([
      "book_fact",
      "ai_interpretation",
      "external_research",
      "critique",
    ]);
  });
});

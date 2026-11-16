/**
 * Шаг 6. Визуальные материалы.
 *
 * Для каждой концепции модель выбирает один из шести типов схемы и заполняет подписи.
 * Рисует схему компонент интерфейса, поэтому здесь проверяется только спецификация:
 * число элементов и длина подписей должны подходить выбранному типу.
 * Концепция, для которой подходящей схемы не нашлось, показывается без неё.
 */
import { z } from "zod";

import { checkDiagram } from "../checks/diagram";
import type { Step } from "../runner";
import { diagramSchema, type Diagram } from "../schema";
import { bookLine, generateChecked, systemPrompt } from "./shared";
import { need, type AnalysisState } from "./state";

export const visualsOutputSchema = z.object({
  diagrams: z.array(z.object({ conceptId: z.string(), diagram: diagramSchema })),
});
export type VisualsOutput = z.infer<typeof visualsOutputSchema>;

const visualsDraft = z.object({
  diagrams: z.array(
    z.object({ conceptId: z.string(), diagram: diagramSchema.nullable() }),
  ),
});

export const visualsStep: Step<AnalysisState, VisualsOutput> = {
  name: "visuals",
  version: "1",
  tiers: ["main"],
  schema: visualsOutputSchema,
  input: (state) => ({
    book: state.book,
    concepts: state.analysis?.content.concepts,
    claims: state.analysis?.claims,
    language: state.request.language,
  }),
  async run(state, ctx) {
    const book = need(state, "book");
    const { content, claims } = need(state, "analysis");
    if (content.concepts.length === 0) return { diagrams: [] };

    const textOf = (id: string | null) =>
      claims.find((claim) => claim.id === id)?.text ?? "";
    const conceptIds = new Set(content.concepts.map((concept) => concept.id));

    const diagrams = await generateChecked(
      ctx.model,
      {
        task: "visuals.diagrams",
        tier: "main",
        system: systemPrompt(state.request.language),
        schema: visualsDraft,
        prompt: `Design one diagram for each key concept of the book ${bookLine(book)}.

Concepts:
${content.concepts
  .map(
    (c) =>
      `${c.id} — ${c.name} (${c.kind}): ${textOf(c.statement)} ${textOf(c.explanation)}`,
  )
  .join("\n")}

Choose the type that matches the concept's real shape:
- cycle — a repeating loop of 3–6 stages; items are the stages in order;
- flow — a one-way sequence of 3–6 steps; items in order;
- pyramid — 3–5 levels where each rests on the one below; items from base to top;
- matrix — a 2×2 grid; axes are the two axis names, items are the four quadrants in the order top-left, top-right, bottom-left, bottom-right;
- comparison — 2–3 things compared; axes are their names, items are 2–6 rows, with the label naming the criterion and the note giving the values;
- tree — one whole divided into 2–6 parts; items are the parts.
Give the diagram a title. Labels are at most 48 characters; "note" is a short clarification or null. Use only what the concept's description above states — do not add stages, levels or parts it does not mention. If no type fits a concept honestly, return null for its diagram.`,
      },
      (object) => {
        const problems: string[] = [];
        const accepted: { conceptId: string; diagram: Diagram }[] = [];
        for (const entry of object.diagrams) {
          if (!conceptIds.has(entry.conceptId)) {
            problems.push(`Concept ${entry.conceptId} does not exist.`);
          } else if (entry.diagram) {
            const found = checkDiagram(entry.diagram);
            if (found.length > 0)
              problems.push(...found.map((p) => `${entry.conceptId}: ${p}`));
            else if (!accepted.some((a) => a.conceptId === entry.conceptId)) {
              accepted.push({ conceptId: entry.conceptId, diagram: entry.diagram });
            }
          }
        }
        return { result: accepted, problems };
      },
    );
    return { diagrams };
  },
  apply: (state, visuals) => ({ ...state, visuals }),
};

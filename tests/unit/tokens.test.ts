import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/contrast";

const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

/** Читает пары light-dark(#светлая, #тёмная) прямо из файла токенов. */
function readTokens(): Record<string, { light: string; dark: string }> {
  const tokens: Record<string, { light: string; dark: string }> = {};
  const pattern =
    /(--[\w-]+):\s*light-dark\(\s*(#[0-9a-f]{6})\s*,\s*(#[0-9a-f]{6})\s*\)/gi;
  for (const [, name, light, dark] of css.matchAll(pattern)) {
    tokens[name] = { light, dark };
  }
  return tokens;
}

const tokens = readTokens();
const THEMES = ["light", "dark"] as const;
const BACKGROUNDS = ["--bg", "--surface", "--surface-2"];
const TEXT_COLORS = [
  "--text",
  "--text-2",
  "--accent",
  "--src-book",
  "--src-ai",
  "--src-research",
  "--src-critique",
];

describe("contrastRatio", () => {
  it("считает по формуле WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBe(1);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("не принимает цвет в другом формате", () => {
    expect(() => contrastRatio("red", "#ffffff")).toThrow();
  });
});

describe("дизайн-токены", () => {
  it("содержат все цвета из дизайн-системы", () => {
    expect(Object.keys(tokens)).toEqual(
      expect.arrayContaining([...BACKGROUNDS, ...TEXT_COLORS, "--border", "--on-accent"]),
    );
  });

  for (const theme of THEMES) {
    describe(`тема ${theme}`, () => {
      for (const text of TEXT_COLORS) {
        for (const background of BACKGROUNDS) {
          it(`${text} на ${background}: контраст не ниже 4.5`, () => {
            const ratio = contrastRatio(tokens[text][theme], tokens[background][theme]);
            expect(ratio).toBeGreaterThanOrEqual(4.5);
          });
        }
      }

      it("текст на акцентной кнопке: контраст не ниже 4.5", () => {
        const ratio = contrastRatio(
          tokens["--on-accent"][theme],
          tokens["--accent"][theme],
        );
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      });

      it("граница полей ввода: контраст с фоном не ниже 3", () => {
        for (const background of BACKGROUNDS) {
          const ratio = contrastRatio(
            tokens["--border-strong"][theme],
            tokens[background][theme],
          );
          expect(ratio).toBeGreaterThanOrEqual(3);
        }
      });
    });
  }
});

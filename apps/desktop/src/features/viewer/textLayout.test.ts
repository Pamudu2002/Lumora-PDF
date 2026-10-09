import { describe, expect, it } from "vitest";
import type { TextRun } from "@/lib/ipc";
import { layoutText } from "./textLayout";

function run(text: string, x: number, y: number, width: number, height = 10): TextRun {
  return { text, rect: { x, y, width, height } };
}

/** The text copying all of it would produce, with paragraphs marked by "¶". */
function copied(runs: TextRun[]): string {
  return layoutText(runs)
    .map((para) => para.map((r) => r.sep + r.text).join(""))
    .join("¶");
}

describe("layoutText", () => {
  it("joins runs on a line, with a space only where there is a gap", () => {
    expect(copied([run("Hello", 0, 0, 25), run("world", 30, 1, 25), run("!", 55, 0, 3)])).toBe(
      "Hello world!",
    );
    // Runs that already carry the space don't get another.
    expect(copied([run("Hello ", 0, 0, 28), run("world", 30, 0, 25)])).toBe("Hello world");
  });

  it("breaks lines, and paragraphs at large gaps or size changes", () => {
    const text = copied([
      run("Title", 0, 0, 60, 20),
      run("First line", 0, 30, 50),
      run("second line", 0, 42, 55),
      run("Next paragraph", 0, 70, 70),
    ]);
    expect(text).toBe("Title¶\nFirst line\nsecond line¶\nNext paragraph");
  });

  it("keeps loosely spaced lines together and breaks at a wider gap", () => {
    // Glyph boxes are tighter than the font size, so even normal leading leaves a gap of
    // about one box height between lines.
    const text = copied([
      run("One", 0, 0, 20, 8),
      run("two", 0, 16, 20, 8),
      run("three", 0, 32, 25, 8),
      run("Four", 0, 60, 20, 8),
    ]);
    expect(text).toBe("One\ntwo\nthree¶\nFour");
  });

  it("starts a paragraph when text jumps back up, as in a second column", () => {
    const text = copied([run("Left", 0, 100, 40), run("Right", 300, 0, 40)]);
    expect(text).toBe("Left¶\nRight");
  });

  it("drops blank runs and runs without a usable box", () => {
    const text = copied([
      run("  ", 0, 0, 10),
      run("Kept", 0, 0, 20),
      run("Zero", 30, 0, 0),
      { text: "NaN", rect: { x: Number.NaN, y: 0, width: 5, height: 5 } },
    ]);
    expect(text).toBe("Kept");
  });
});

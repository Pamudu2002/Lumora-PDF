import type { TextRun } from "@/lib/ipc";

/** A text run placed on the page, in display points (top-left origin). */
export interface PlacedRun {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** What goes between the previous run and this one when copying: "", " " or "\n". */
  sep: string;
}

/** Runs that read as one block; triple-click selects one. */
export type TextParagraph = PlacedRun[];

/** Two runs share a line when they overlap vertically by more than this share of the shorter. */
const SAME_LINE_OVERLAP = 0.5;
/** A horizontal gap wider than this share of the text height reads as a space. */
const SPACE_GAP = 0.15;
/** The second line of a paragraph may sit at most this many line heights below the first. */
const FIRST_LINE_GAP = 1.2;
/** Later lines start a paragraph when their gap is this much wider than the paragraph's own. */
const LINE_GAP_GROWTH = 1.4;
/** Lines whose heights differ by more than this ratio belong to different paragraphs. */
const SIZE_CHANGE = 1.3;

/**
 * Groups the runs (already in reading order) into lines and paragraphs, and works out the
 * separators that copying puts between them. Runs that are blank or have no usable box are dropped.
 */
export function layoutText(runs: readonly TextRun[]): TextParagraph[] {
  const paragraphs: TextParagraph[] = [];
  let current: TextParagraph = [];
  let prev: PlacedRun | null = null;
  // The extent of the current line, to measure the gap to the next one.
  let lineTop = 0;
  let lineBottom = 0;
  // The gap between the lines of the current paragraph, once it has two lines.
  let paragraphGap: number | null = null;

  for (const run of runs) {
    const { x, y, width, height } = run.rect;
    if (run.text.trim() === "" || !(width > 0) || !(height > 0)) continue;
    if (![x, y, width, height].every(Number.isFinite)) continue;
    const placed: PlacedRun = { text: run.text, x, y, width, height, sep: "" };

    if (prev) {
      const overlap = Math.min(prev.y + prev.height, y + height) - Math.max(prev.y, y);
      const sameLine =
        overlap > SAME_LINE_OVERLAP * Math.min(prev.height, height) &&
        x >= prev.x + prev.width * 0.5;
      if (sameLine) {
        const gap = x - (prev.x + prev.width);
        const spaced = /\s$/.test(prev.text) || /^\s/.test(run.text);
        placed.sep = gap > SPACE_GAP * Math.min(prev.height, height) && !spaced ? " " : "";
        lineTop = Math.min(lineTop, y);
        lineBottom = Math.max(lineBottom, y + height);
      } else {
        placed.sep = "\n";
        const lineHeight = lineBottom - lineTop;
        const gap = y - lineBottom;
        const ratio = Math.max(height, prev.height) / Math.min(height, prev.height);
        const tooFar =
          paragraphGap === null
            ? gap > FIRST_LINE_GAP * lineHeight
            : gap > paragraphGap * LINE_GAP_GROWTH + 0.1 * lineHeight;
        const newParagraph = tooFar || gap < -lineHeight || ratio > SIZE_CHANGE;
        if (newParagraph && current.length > 0) {
          paragraphs.push(current);
          current = [];
          paragraphGap = null;
        } else {
          paragraphGap = Math.max(gap, 0);
        }
        lineTop = y;
        lineBottom = y + height;
      }
    } else {
      lineTop = y;
      lineBottom = y + height;
    }
    current.push(placed);
    prev = placed;
  }
  if (current.length > 0) paragraphs.push(current);
  return paragraphs;
}

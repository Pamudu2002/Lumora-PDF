// Page selection and image URLs for printing. Pages print as whole-page images rendered by the
// engine (`lumora://…/print/…`), see the Decision log entry for task 1.15.
import { lumoraBase, type PagePoints } from "@/lib/tiles";

/** Print resolution. */
export const PRINT_DPI = 300;
/** Largest edge of a print image in pixels; mirrors `MAX_PAGE_IMAGE_PX` in lumora-engine. */
export const MAX_PRINT_IMAGE_PX = 8192;

/**
 * The render scale × 1000 for printing a page: {@link PRINT_DPI}, lowered for pages so large that
 * the image would exceed {@link MAX_PRINT_IMAGE_PX}.
 */
export function printScaleMilli(size: PagePoints): number {
  const longest = Math.max(size.widthPt, size.heightPt, 1);
  const scale = Math.min(PRINT_DPI / 72, MAX_PRINT_IMAGE_PX / longest);
  return Math.max(1, Math.floor(scale * 1000));
}

/** The URL of a whole page rendered for printing. */
export function printPageUrl(
  p: { docId: number; page: number; scaleMilli: number; rev: number },
  base: string = lumoraBase(),
): string {
  return `${base}print/${p.docId}/${p.page}/${p.scaleMilli}?rev=${p.rev}`;
}

/**
 * Parses a page selection such as "1-5, 8, 10-12" (one-based, as typed by the user) into
 * zero-based page indexes in the order given, without repeats. Returns null if any part is not a
 * page or range inside 1..pageCount, or if nothing is selected.
 */
export function parsePageRange(text: string, pageCount: number): number[] | null {
  const pages: number[] = [];
  const seen = new Set<number>();
  const parts = text
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  if (parts.length === 0) return null;
  for (const part of parts) {
    const match = /^(\d+)\s*(?:[-–]\s*(\d+))?$/.exec(part);
    if (!match?.[1]) return null;
    const first = Number(match[1]);
    const last = match[2] === undefined ? first : Number(match[2]);
    if (first < 1 || last < first || last > pageCount) return null;
    for (let n = first; n <= last; n++) {
      if (!seen.has(n)) {
        seen.add(n);
        pages.push(n - 1);
      }
    }
  }
  return pages;
}

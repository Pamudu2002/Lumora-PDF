// Page layout for the document view: where every page sits at a zoom, layout mode and rotation.
// Pure functions, so they're cheap to recompute and easy to test.
import type { PagePoints } from "@/lib/tiles";

/** CSS pixels per PDF point at 100% zoom: 100% means actual size on a 96 dpi screen. */
export const PT_TO_CSS = 96 / 72;
/** Space between pages and around the document, in CSS px (design token space-4). */
export const PAGE_GAP = 16;
/** Extra space below the last page so the floating zoom bar never covers it. */
export const BOTTOM_PADDING = 72;

export type LayoutMode = "single" | "continuous" | "twoPage";
export type Rotation = 0 | 90 | 180 | 270;

export interface LayoutOptions {
  /** 1 = 100%. */
  zoom: number;
  mode: LayoutMode;
  /** Two-page mode: show the first page on its own, like a book cover. */
  coverPage: boolean;
  /** View rotation (doesn't change the file). */
  rotation: Rotation;
  /** Width of the scrollable viewport in CSS px; pages are centered in it. */
  viewportWidth: number;
}

/** A page's box in the document view, in CSS px, with the view rotation applied. */
export interface PageBox {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A row of pages laid out side by side (one page, or a two-page spread). */
export interface LayoutRow {
  top: number;
  height: number;
  pages: number[];
}

export interface DocLayout {
  pages: PageBox[];
  rows: LayoutRow[];
  /** Index of each page's row. */
  rowOfPage: number[];
  width: number;
  height: number;
}

/** A page's size in CSS px at a zoom, with the view rotation applied. */
export function pageCssSize(page: PagePoints, zoom: number, rotation: Rotation) {
  const w = page.widthPt * zoom * PT_TO_CSS;
  const h = page.heightPt * zoom * PT_TO_CSS;
  return rotation === 90 || rotation === 270 ? { width: h, height: w } : { width: w, height: h };
}

/** Groups pages into rows: one page per row, or spreads of two. */
export function groupRows(pageCount: number, mode: LayoutMode, coverPage: boolean): number[][] {
  const rows: number[][] = [];
  if (mode !== "twoPage") {
    for (let i = 0; i < pageCount; i++) rows.push([i]);
    return rows;
  }
  let i = 0;
  if (coverPage && pageCount > 0) {
    rows.push([0]);
    i = 1;
  }
  for (; i < pageCount; i += 2) {
    rows.push(i + 1 < pageCount ? [i, i + 1] : [i]);
  }
  return rows;
}

/** Lays out every page. Single-page mode uses the same layout; the view shows one row at a time. */
export function layoutPages(sizes: readonly PagePoints[], opts: LayoutOptions): DocLayout {
  const rowsOfPages = groupRows(sizes.length, opts.mode, opts.coverPage);
  const pages: PageBox[] = new Array<PageBox>(sizes.length);
  const rowOfPage: number[] = new Array<number>(sizes.length).fill(0);
  const rows: LayoutRow[] = [];

  // First pass: row sizes, to find the widest row.
  const measured = rowsOfPages.map((indices) => {
    const boxes = indices.map((i) => pageCssSize(sizes[i] ?? FALLBACK, opts.zoom, opts.rotation));
    const width = boxes.reduce((sum, b) => sum + b.width, 0) + PAGE_GAP * (boxes.length - 1);
    const height = Math.max(0, ...boxes.map((b) => b.height));
    return { indices, boxes, width, height };
  });
  const widest = Math.max(0, ...measured.map((r) => r.width));
  const width = Math.max(opts.viewportWidth, widest + PAGE_GAP * 2);

  let y = PAGE_GAP;
  measured.forEach((row, rowIndex) => {
    let x = (width - row.width) / 2;
    row.indices.forEach((pageIndex, i) => {
      const box = row.boxes[i] ?? { width: 0, height: 0 };
      pages[pageIndex] = {
        index: pageIndex,
        x,
        // Pages in a spread are vertically centered on each other.
        y: y + (row.height - box.height) / 2,
        width: box.width,
        height: box.height,
      };
      rowOfPage[pageIndex] = rowIndex;
      x += box.width + PAGE_GAP;
    });
    rows.push({ top: y, height: row.height, pages: row.indices });
    y += row.height + PAGE_GAP;
  });

  return { pages, rows, rowOfPage, width, height: y - PAGE_GAP + BOTTOM_PADDING };
}

const FALLBACK: PagePoints = { widthPt: 612, heightPt: 792 };

/** Index of the first row whose bottom edge is below `y` (binary search). */
export function rowAt(layout: DocLayout, y: number): number {
  const { rows } = layout;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const row = rows[mid];
    if (row && row.top + row.height + PAGE_GAP / 2 < y) lo = mid + 1;
    else hi = mid;
  }
  return Math.max(0, lo);
}

/** Pages in rows that intersect `[top, bottom]`, in order. */
export function pagesInRange(layout: DocLayout, top: number, bottom: number): number[] {
  if (layout.rows.length === 0) return [];
  const result: number[] = [];
  for (let r = rowAt(layout, top); r < layout.rows.length; r++) {
    const row = layout.rows[r];
    if (!row || row.top > bottom) break;
    result.push(...row.pages);
  }
  return result;
}

/** The page the reader is on: the first page of the row crossing a line 30% down the viewport. */
export function currentPageAt(
  layout: DocLayout,
  scrollTop: number,
  viewportHeight: number,
): number {
  const row = layout.rows[rowAt(layout, scrollTop + viewportHeight * 0.3)];
  return row?.pages[0] ?? 0;
}

/** A point inside a page, as fractions of the page box (so it survives zoom changes). */
export interface PageAnchor {
  page: number;
  fx: number;
  fy: number;
}

/** The page point under document position (x, y), or the nearest page's edge. */
export function anchorAt(layout: DocLayout, x: number, y: number): PageAnchor | null {
  const row = layout.rows[rowAt(layout, y)];
  if (!row) return null;
  // Pick the page in the row closest to x.
  let best: PageBox | undefined;
  let bestDistance = Infinity;
  for (const index of row.pages) {
    const box = layout.pages[index];
    if (!box) continue;
    const distance = x < box.x ? box.x - x : x > box.x + box.width ? x - (box.x + box.width) : 0;
    if (distance < bestDistance) {
      best = box;
      bestDistance = distance;
    }
  }
  if (!best || best.width === 0 || best.height === 0) return null;
  return {
    page: best.index,
    fx: (x - best.x) / best.width,
    fy: (y - best.y) / best.height,
  };
}

/** Document position of an anchor in a (new) layout. */
export function anchorPosition(
  layout: DocLayout,
  anchor: PageAnchor,
): { x: number; y: number } | null {
  const box = layout.pages[anchor.page];
  if (!box) return null;
  return { x: box.x + anchor.fx * box.width, y: box.y + anchor.fy * box.height };
}

/** The zoom at which the widest row fills the viewport width. */
export function fitWidthZoom(
  sizes: readonly PagePoints[],
  opts: Omit<LayoutOptions, "zoom" | "viewportWidth">,
  viewportWidth: number,
): number {
  const atOne = layoutPages(sizes, { ...opts, zoom: 1, viewportWidth: 0 });
  const widestRow = atOne.width - PAGE_GAP * 2;
  const spreadGaps = opts.mode === "twoPage" ? PAGE_GAP : 0;
  if (widestRow <= 0) return 1;
  return Math.max(0.05, (viewportWidth - PAGE_GAP * 2 - spreadGaps) / (widestRow - spreadGaps));
}

/** The zoom at which a whole row (the current one) fits in the viewport. */
export function fitPageZoom(
  sizes: readonly PagePoints[],
  opts: Omit<LayoutOptions, "zoom" | "viewportWidth">,
  viewportWidth: number,
  viewportHeight: number,
  page: number,
): number {
  const atOne = layoutPages(sizes, { ...opts, zoom: 1, viewportWidth: 0 });
  const row = atOne.rows[atOne.rowOfPage[page] ?? 0];
  if (!row) return 1;
  const rowWidth = row.pages.reduce((w, i) => w + (atOne.pages[i]?.width ?? 0), 0);
  const gaps = PAGE_GAP * (row.pages.length - 1);
  const byWidth = (viewportWidth - PAGE_GAP * 2 - gaps) / Math.max(1, rowWidth);
  const byHeight = (viewportHeight - PAGE_GAP * 2) / Math.max(1, row.height);
  return Math.max(0.05, Math.min(byWidth, byHeight));
}

/**
 * Single-page mode: only `page` is laid out, at the top of the view. Other entries of `pages` stay
 * empty; `rowOfPage` maps every page to the one row.
 */
export function singlePageLayout(
  sizes: readonly PagePoints[],
  page: number,
  opts: Omit<LayoutOptions, "mode" | "coverPage">,
): DocLayout {
  const size = sizes[page];
  if (!size) return { pages: [], rows: [], rowOfPage: [], width: opts.viewportWidth, height: 0 };
  const { width: w, height: h } = pageCssSize(size, opts.zoom, opts.rotation);
  const width = Math.max(opts.viewportWidth, w + PAGE_GAP * 2);
  const pages: PageBox[] = [];
  pages[page] = { index: page, x: (width - w) / 2, y: PAGE_GAP, width: w, height: h };
  return {
    pages,
    rows: [{ top: PAGE_GAP, height: h, pages: [page] }],
    rowOfPage: sizes.map(() => 0),
    width,
    height: h + PAGE_GAP + BOTTOM_PADDING,
  };
}

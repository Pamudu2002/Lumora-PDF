import { describe, expect, it } from "vitest";
import {
  PAGE_GAP,
  PT_TO_CSS,
  anchorAt,
  anchorPosition,
  currentPageAt,
  fitPageZoom,
  fitWidthZoom,
  groupRows,
  layoutPages,
  pagesInRange,
  rowAt,
  singlePageLayout,
  type LayoutOptions,
} from "./layout";

/** The element at `i`, failing the test if it's missing. */
function at<T>(items: readonly (T | undefined)[], i: number): T {
  const item = items[i];
  if (item === undefined) throw new Error(`no item at ${i}`);
  return item;
}

const letter = { widthPt: 612, heightPt: 792 };
const landscape = { widthPt: 792, heightPt: 612 };
const base: LayoutOptions = {
  zoom: 1,
  mode: "continuous",
  coverPage: false,
  rotation: 0,
  viewportWidth: 1000,
};

describe("groupRows", () => {
  it("groups spreads with and without a cover page", () => {
    expect(groupRows(3, "continuous", false)).toEqual([[0], [1], [2]]);
    expect(groupRows(5, "twoPage", false)).toEqual([[0, 1], [2, 3], [4]]);
    expect(groupRows(5, "twoPage", true)).toEqual([[0], [1, 2], [3, 4]]);
    expect(groupRows(0, "twoPage", true)).toEqual([]);
  });
});

describe("layoutPages", () => {
  it("stacks pages with gaps and centers them", () => {
    const layout = layoutPages([letter, letter, letter], base);
    const w = 612 * PT_TO_CSS;
    const h = 792 * PT_TO_CSS;
    expect(layout.pages[0]).toEqual({
      index: 0,
      x: (1000 - w) / 2,
      y: PAGE_GAP,
      width: w,
      height: h,
    });
    expect(layout.pages[1]?.y).toBeCloseTo(PAGE_GAP * 2 + h);
    expect(layout.width).toBe(1000);
  });

  it("widens the document when pages are wider than the viewport", () => {
    const layout = layoutPages([letter], { ...base, zoom: 4 });
    expect(layout.width).toBeCloseTo(612 * PT_TO_CSS * 4 + PAGE_GAP * 2);
    expect(layout.pages[0]?.x).toBeCloseTo(PAGE_GAP);
  });

  it("swaps width and height for rotated views", () => {
    const layout = layoutPages([letter], { ...base, rotation: 90 });
    expect(layout.pages[0]?.width).toBeCloseTo(792 * PT_TO_CSS);
    expect(layout.pages[0]?.height).toBeCloseTo(612 * PT_TO_CSS);
  });

  it("puts spreads side by side and centers mixed heights", () => {
    const layout = layoutPages([letter, landscape], {
      ...base,
      mode: "twoPage",
      viewportWidth: 3000,
    });
    expect(layout.rows).toHaveLength(1);
    const [a, b] = [at(layout.pages, 0), at(layout.pages, 1)];
    expect(b.x).toBeCloseTo(a.x + a.width + PAGE_GAP);
    // The shorter landscape page is centered vertically against the taller one.
    expect(b.y).toBeCloseTo(PAGE_GAP + ((792 - 612) * PT_TO_CSS) / 2);
  });
});

describe("visibility", () => {
  const many = layoutPages(
    Array.from({ length: 500 }, () => letter),
    base,
  );
  const pageStep = 792 * PT_TO_CSS + PAGE_GAP;

  it("finds rows by position", () => {
    expect(rowAt(many, 0)).toBe(0);
    expect(rowAt(many, pageStep * 10 + 50)).toBe(10);
    expect(rowAt(many, 1e9)).toBe(499);
  });

  it("returns only the pages in a range", () => {
    // Page 101 starts PAGE_GAP below the step boundary.
    expect(pagesInRange(many, pageStep * 100 + 10, pageStep * 101 + 10)).toEqual([100]);
    expect(pagesInRange(many, pageStep * 100 + 10, pageStep * 101 + PAGE_GAP + 1)).toEqual([
      100, 101,
    ]);
  });

  it("reports the current page", () => {
    expect(currentPageAt(many, 0, 800)).toBe(0);
    expect(currentPageAt(many, pageStep * 42, 800)).toBe(42);
  });
});

describe("zoom anchoring", () => {
  it("keeps the same page point under the cursor", () => {
    const before = layoutPages([letter, letter], base);
    const box = at(before.pages, 1);
    const anchor = anchorAt(before, box.x + box.width / 4, box.y + box.height / 2);
    if (!anchor) throw new Error("no anchor");
    expect(anchor.page).toBe(1);
    expect(anchor.fx).toBeCloseTo(0.25);

    const after = layoutPages([letter, letter], { ...base, zoom: 2 });
    const pos = anchorPosition(after, anchor);
    if (!pos) throw new Error("no position");
    const box2 = at(after.pages, 1);
    expect(pos.x).toBeCloseTo(box2.x + box2.width / 4);
    expect(pos.y).toBeCloseTo(box2.y + box2.height / 2);
  });
});

describe("fit zoom", () => {
  it("fits the page width and the whole page", () => {
    const opts = { mode: "continuous" as const, coverPage: false, rotation: 0 as const };
    const z = fitWidthZoom([letter], opts, 1000);
    expect(612 * PT_TO_CSS * z).toBeCloseTo(1000 - PAGE_GAP * 2);
    const zp = fitPageZoom([letter], opts, 1000, 600, 0);
    expect(792 * PT_TO_CSS * zp).toBeCloseTo(600 - PAGE_GAP * 2);
  });
});

describe("singlePageLayout", () => {
  it("lays out only the current page at the top", () => {
    const layout = singlePageLayout([letter, letter, letter], 1, {
      zoom: 1,
      rotation: 0,
      viewportWidth: 1000,
    });
    expect(layout.pages[0]).toBeUndefined();
    expect(layout.pages[1]?.y).toBe(PAGE_GAP);
    expect(layout.rows).toEqual([{ top: PAGE_GAP, height: 792 * PT_TO_CSS, pages: [1] }]);
    expect(currentPageAt(layout, 0, 800)).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { THUMB_W, layoutThumbs, thumbMaxPx, thumbsInRange } from "./thumbLayout";

const letter = { widthPt: 612, heightPt: 792 };
const landscape = { widthPt: 792, heightPt: 612 };

describe("layoutThumbs", () => {
  it("stacks thumbnails with their page's aspect ratio", () => {
    const layout = layoutThumbs([letter, landscape]);
    expect(layout.items[0]?.imageHeight).toBe(Math.round((THUMB_W * 792) / 612));
    expect(layout.items[1]?.imageHeight).toBe(Math.round((THUMB_W * 612) / 792));
    expect(layout.items[1]?.top).toBeGreaterThan(layout.items[0]?.top ?? 0);
  });

  it("survives absurd page sizes", () => {
    const layout = layoutThumbs([
      { widthPt: 0, heightPt: 0 },
      { widthPt: 1, heightPt: 1e6 },
    ]);
    expect(layout.items[0]?.imageHeight).toBeGreaterThan(0);
    expect(layout.items[1]?.imageHeight).toBeLessThanOrEqual(THUMB_W * 10);
  });
});

describe("thumbsInRange", () => {
  it("finds the visible thumbnails in a long list", () => {
    const layout = layoutThumbs(Array.from({ length: 500 }, () => letter));
    const step = (layout.items[1]?.top ?? 0) - (layout.items[0]?.top ?? 0);
    const visible = thumbsInRange(layout, step * 200, step * 202);
    // Item 199 ends just above the range; item 202 starts just below it.
    expect(visible).toEqual([200, 201]);
  });
});

describe("thumbMaxPx", () => {
  it("renders at device resolution, rounded to share cache entries", () => {
    expect(thumbMaxPx(135, 1)).toBe(160);
    expect(thumbMaxPx(135, 2) % 32).toBe(0);
  });
});

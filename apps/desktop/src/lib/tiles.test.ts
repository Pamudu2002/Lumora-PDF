import { describe, expect, it } from "vitest";
import {
  milliToScale,
  pagePixelSize,
  scaleToMilli,
  thumbnailUrl,
  tilesForPage,
  tilesInRect,
  tileUrl,
} from "./tiles";

const WINDOWS_BASE = "http://lumora.localhost/";
const UNIX_BASE = "lumora://localhost/";

describe("tileUrl", () => {
  const params = { docId: 3, page: 12, scaleMilli: 1500, tileX: 1, tileY: 2, rev: 7, dark: true };

  it("builds the Windows form", () => {
    expect(tileUrl(params, WINDOWS_BASE)).toBe(
      "http://lumora.localhost/tile/3/12/1500/1/2?rev=7&dark=1",
    );
  });

  it("builds the macOS/Linux form", () => {
    expect(tileUrl({ ...params, dark: false }, UNIX_BASE)).toBe(
      "lumora://localhost/tile/3/12/1500/1/2?rev=7&dark=0",
    );
  });

  it("builds thumbnail URLs", () => {
    expect(thumbnailUrl({ docId: 1, page: 4, maxPx: 240, rev: 2 }, WINDOWS_BASE)).toBe(
      "http://lumora.localhost/thumb/1/4/240?rev=2",
    );
  });
});

describe("scale helpers", () => {
  it("converts scales to milli and back", () => {
    expect(scaleToMilli(1)).toBe(1000);
    expect(scaleToMilli(1.25)).toBe(1250);
    expect(scaleToMilli(Number.NaN)).toBe(0);
    expect(milliToScale(1500)).toBe(1.5);
  });
});

describe("pagePixelSize", () => {
  it("rounds like the Rust side", () => {
    expect(pagePixelSize({ widthPt: 612, heightPt: 792 }, 1)).toEqual({ width: 612, height: 792 });
    expect(pagePixelSize({ widthPt: 612, heightPt: 792 }, 2)).toEqual({
      width: 1224,
      height: 1584,
    });
    // A4 at 150% (f32 maths): 595.28 × 1.5 = 892.92 → 893.
    expect(pagePixelSize({ widthPt: 595.28, heightPt: 841.89 }, 1.5)).toEqual({
      width: 893,
      height: 1263,
    });
    expect(pagePixelSize({ widthPt: 0.1, heightPt: 0.1 }, 1)).toEqual({ width: 1, height: 1 });
  });
});

describe("tilesForPage", () => {
  it("covers the page with edge tiles cropped", () => {
    const tiles = tilesForPage(612, 792);
    expect(tiles).toHaveLength(4);
    expect(tiles[3]).toEqual({ tileX: 1, tileY: 1, x: 512, y: 512, width: 100, height: 280 });
  });

  it("matches the Rust grid at 2x", () => {
    expect(tilesForPage(1224, 1584)).toHaveLength(12);
  });
});

describe("tilesInRect", () => {
  it("returns only the tiles a rectangle touches", () => {
    const tiles = tilesInRect(2000, 3000, { x: 600, y: 600, w: 100, h: 100 });
    expect(tiles.map((t) => [t.tileX, t.tileY])).toEqual([[1, 1]]);
    // Crossing a tile boundary (1024) needs both rows.
    expect(tilesInRect(2000, 3000, { x: 600, y: 1000, w: 100, h: 100 })).toHaveLength(2);
  });

  it("clamps to the page and handles empty rectangles", () => {
    expect(tilesInRect(1000, 1000, { x: -500, y: -500, w: 5000, h: 5000 })).toHaveLength(4);
    expect(tilesInRect(1000, 1000, { x: 0, y: 0, w: 0, h: 10 })).toEqual([]);
    expect(tilesInRect(1000, 1000, { x: 5000, y: 0, w: 10, h: 10 })).toEqual([]);
  });
});

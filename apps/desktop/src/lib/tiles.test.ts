import { describe, expect, it } from "vitest";
import {
  milliToScale,
  pagePixelSize,
  scaleToMilli,
  thumbnailUrl,
  tilesForPage,
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

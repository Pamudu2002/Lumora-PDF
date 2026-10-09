import { describe, expect, it } from "vitest";
import type { Rotation } from "./layout";
import { boxToContent, contentToBox } from "./rotation";

// A 100 × 200 page (unrotated).
const w0 = 100;
const h0 = 200;

describe("boxToContent", () => {
  it("is the identity without rotation", () => {
    expect(boxToContent({ x: 1, y: 2, w: 3, h: 4 }, 0, w0, h0)).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it.each<[Rotation, { x: number; y: number }]>([
    // The content's top-left 10 × 10 square appears here in each rotated box.
    [90, { x: h0 - 10, y: 0 }],
    [180, { x: w0 - 10, y: h0 - 10 }],
    [270, { x: 0, y: w0 - 10 }],
  ])("maps the rotated %i° box back to the content's top-left", (rotation, boxPos) => {
    const r = boxToContent({ ...boxPos, w: 10, h: 10 }, rotation, w0, h0);
    expect(r).toEqual({ x: 0, y: 0, w: 10, h: 10 });
  });
});

describe("contentToBox", () => {
  it.each<Rotation>([0, 90, 180, 270])("is the inverse of boxToContent at %i°", (rotation) => {
    // A point in content space maps into the box and back.
    const p = contentToBox(30, 40, rotation, w0, h0);
    const back = boxToContent({ x: p.x, y: p.y, w: 0, h: 0 }, rotation, w0, h0);
    expect(back.x).toBeCloseTo(30);
    expect(back.y).toBeCloseTo(40);
  });
});

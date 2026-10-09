// View rotation helpers. A page's content is drawn unrotated (`w0 × h0` CSS px) and rotated into
// its box with a CSS transform; these map between the two coordinate spaces.
import type { Rotation } from "./layout";

export interface RectLike {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Maps a rectangle from the rotated box into the unrotated page content. */
export function boxToContent(r: RectLike, rotation: Rotation, w0: number, h0: number): RectLike {
  switch (rotation) {
    case 90:
      return { x: r.y, y: h0 - (r.x + r.w), w: r.h, h: r.w };
    case 180:
      return { x: w0 - (r.x + r.w), y: h0 - (r.y + r.h), w: r.w, h: r.h };
    case 270:
      return { x: w0 - (r.y + r.h), y: r.x, w: r.h, h: r.w };
    default:
      return r;
  }
}

/** Maps a point in the unrotated page content into the rotated box. */
export function contentToBox(
  x: number,
  y: number,
  rotation: Rotation,
  w0: number,
  h0: number,
): { x: number; y: number } {
  switch (rotation) {
    case 90:
      return { x: h0 - y, y: x };
    case 180:
      return { x: w0 - x, y: h0 - y };
    case 270:
      return { x: y, y: w0 - x };
    default:
      return { x, y };
  }
}

/** CSS transform that rotates unrotated content (`w0 × h0`) into its rotated box. */
export function contentTransform(rotation: Rotation, w0: number, h0: number): string | undefined {
  switch (rotation) {
    case 90:
      return `translate(${h0}px, 0) rotate(90deg)`;
    case 180:
      return `translate(${w0}px, ${h0}px) rotate(180deg)`;
    case 270:
      return `translate(0, ${w0}px) rotate(270deg)`;
    default:
      return undefined;
  }
}

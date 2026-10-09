// Positions of page thumbnails in the sidebar list (a virtualized column).
import type { PagePoints } from "@/lib/tiles";

/** Thumbnail width in CSS px (the design's 104 px page inside a 120 px column). */
export const THUMB_W = 104;
/** Space between the page image and its number, the number's height, and space between items. */
const LABEL_GAP = 6;
const LABEL_H = 16;
const ITEM_GAP = 16;
export const LIST_PADDING = 8;

export interface ThumbBox {
  top: number;
  /** Height of the page image. */
  imageHeight: number;
  /** Height of the whole item (image + number). */
  height: number;
}

export interface ThumbLayout {
  items: ThumbBox[];
  height: number;
}

/** Lays out one thumbnail per page; each is THUMB_W wide with its page's aspect ratio. */
export function layoutThumbs(sizes: readonly PagePoints[]): ThumbLayout {
  let top = LIST_PADDING;
  const items = sizes.map((size) => {
    const ratio = size.widthPt > 0 ? size.heightPt / size.widthPt : 1.294;
    const imageHeight = Math.round(THUMB_W * Math.min(Math.max(ratio, 0.1), 10));
    const height = imageHeight + LABEL_GAP + LABEL_H;
    const box = { top, imageHeight, height };
    top += height + ITEM_GAP;
    return box;
  });
  return { items, height: top - ITEM_GAP + LIST_PADDING };
}

/** Indices of thumbnails intersecting `[top, bottom]`. */
export function thumbsInRange(layout: ThumbLayout, top: number, bottom: number): number[] {
  const { items } = layout;
  let lo = 0;
  let hi = items.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const item = items[mid];
    if (item && item.top + item.height < top) lo = mid + 1;
    else hi = mid;
  }
  const result: number[] = [];
  for (let i = Math.max(0, lo); i < items.length; i++) {
    const item = items[i];
    if (!item || item.top > bottom) break;
    result.push(i);
  }
  return result;
}

/** Thumbnail render size: the longer edge in device pixels, rounded up so sizes are shared. */
export function thumbMaxPx(imageHeight: number, dpr: number): number {
  const longest = Math.max(THUMB_W, imageHeight) * dpr;
  return Math.min(2048, Math.ceil(longest / 32) * 32);
}

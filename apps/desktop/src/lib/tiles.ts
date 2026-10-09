// Tile URLs and tile math for the `lumora://` protocol (plan section 3.5).
// Mirrors crates/lumora-render/src/tiles.rs and apps/desktop/src-tauri/src/protocol.rs; keep in sync.
import { convertFileSrc } from "@tauri-apps/api/core";

/** Tile edge in pixels. */
export const TILE_SIZE = 512;

/** A page size in PDF points. */
export interface PagePoints {
  widthPt: number;
  heightPt: number;
}

export interface TileParams {
  docId: number;
  page: number;
  /** Render scale × 1000 (see {@link scaleToMilli}). */
  scaleMilli: number;
  tileX: number;
  tileY: number;
  /** Document revision; a new revision gives new URLs, so the browser never shows stale tiles. */
  rev: number;
  dark: boolean;
}

export interface ThumbnailParams {
  docId: number;
  page: number;
  /** Longer edge in pixels. */
  maxPx: number;
  rev: number;
}

let cachedBase: string | undefined;

/**
 * The protocol's base URL with a trailing slash. Tauri serves custom schemes as
 * `http://lumora.localhost/` on Windows and `lumora://localhost/` elsewhere, so always build URLs
 * through this helper instead of hard-coding either form.
 */
export function lumoraBase(): string {
  cachedBase ??= convertFileSrc("", "lumora");
  return cachedBase.endsWith("/") ? cachedBase : `${cachedBase}/`;
}

/** The URL of one tile. `base` defaults to {@link lumoraBase}. */
export function tileUrl(p: TileParams, base: string = lumoraBase()): string {
  const path = `tile/${p.docId}/${p.page}/${p.scaleMilli}/${p.tileX}/${p.tileY}`;
  return `${base}${path}?rev=${p.rev}&dark=${p.dark ? 1 : 0}`;
}

/** The URL of a page thumbnail. `base` defaults to {@link lumoraBase}. */
export function thumbnailUrl(p: ThumbnailParams, base: string = lumoraBase()): string {
  return `${base}thumb/${p.docId}/${p.page}/${p.maxPx}?rev=${p.rev}`;
}

/** Render scale → integer milli-scale used in URLs (1.0 → 1000). */
export function scaleToMilli(scale: number): number {
  const milli = Math.round(scale * 1000);
  return Number.isFinite(milli) && milli > 0 ? milli : 0;
}

/** Milli-scale → the exact scale the Rust side renders with (an f32). */
export function milliToScale(milli: number): number {
  return Math.fround(milli / 1000);
}

/**
 * A page's pixel size at a scale, rounded exactly like Rust's `PageSize::pixel_size` (f32 maths,
 * each edge at least 1 px), so tiles line up with the page box.
 */
export function pagePixelSize(page: PagePoints, scale: number): { width: number; height: number } {
  const px = (pt: number) => {
    const v = Math.round(Math.fround(Math.fround(pt) * Math.fround(scale)));
    return Number.isFinite(v) && v >= 1 ? v : 1;
  };
  return { width: px(page.widthPt), height: px(page.heightPt) };
}

/** One tile of a page: grid position and pixel rectangle. */
export interface TileRect {
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Every tile covering a page of `width × height` pixels. */
export function tilesForPage(width: number, height: number, tileSize = TILE_SIZE): TileRect[] {
  const tiles: TileRect[] = [];
  for (let tileY = 0; tileY * tileSize < height; tileY++) {
    for (let tileX = 0; tileX * tileSize < width; tileX++) {
      const x = tileX * tileSize;
      const y = tileY * tileSize;
      tiles.push({
        tileX,
        tileY,
        x,
        y,
        width: Math.min(tileSize, width - x),
        height: Math.min(tileSize, height - y),
      });
    }
  }
  return tiles;
}

/**
 * Tiles of a `width × height` page that intersect the rectangle `(x, y, w, h)` (all in device
 * pixels at the render scale). Pass a rectangle larger than the viewport to prefetch a margin.
 */
export function tilesInRect(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
  tileSize = TILE_SIZE,
): TileRect[] {
  if (rect.w <= 0 || rect.h <= 0) return [];
  const cols = Math.ceil(width / tileSize);
  const rows = Math.ceil(height / tileSize);
  const x0 = Math.max(0, Math.floor(rect.x / tileSize));
  const y0 = Math.max(0, Math.floor(rect.y / tileSize));
  const x1 = Math.min(cols, Math.ceil((rect.x + rect.w) / tileSize));
  const y1 = Math.min(rows, Math.ceil((rect.y + rect.h) / tileSize));
  const tiles: TileRect[] = [];
  for (let tileY = y0; tileY < y1; tileY++) {
    for (let tileX = x0; tileX < x1; tileX++) {
      const tx = tileX * tileSize;
      const ty = tileY * tileSize;
      tiles.push({
        tileX,
        tileY,
        x: tx,
        y: ty,
        width: Math.min(tileSize, width - tx),
        height: Math.min(tileSize, height - ty),
      });
    }
  }
  return tiles;
}

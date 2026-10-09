import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  milliToScale,
  pagePixelSize,
  placeholderMilli,
  scaleToMilli,
  tilesInRect,
  tileUrl,
  type PagePoints,
} from "@/lib/tiles";
import { PT_TO_CSS, type PageBox, type Rotation } from "./layout";
import { boxToContent, contentTransform, type RectLike } from "./rotation";
import { TileImage } from "./TileImage";

/** Extra device pixels around the viewport whose tiles are loaded ahead of scrolling. */
const TILE_PREFETCH_PX = 384;

export interface PageViewProps {
  docId: number;
  page: number;
  size: PagePoints;
  /** The page's box in the document, CSS px, rotation applied. */
  box: PageBox;
  rotation: Rotation;
  revision: number;
  dark: boolean;
  /** Current zoom; sets the page's on-screen size. */
  zoom: number;
  /** Zoom the tiles are rendered at. Lags behind `zoom` during gestures so tiles aren't
   * re-rendered for every intermediate step; the existing tiles are stretched meanwhile. */
  renderZoom: number;
  devicePixelRatio: number;
  /** The part of the page box inside the viewport, in box CSS px. */
  visible: RectLike;
  /** Overlays (text, links, search) in unrotated page CSS px, scale `zoom × PT_TO_CSS`. */
  children?: ReactNode;
}

/**
 * One PDF page: the visible `lumora://` tiles, rendered at zoom × devicePixelRatio and shown at one
 * image pixel per device pixel so text stays sharp, plus any overlays.
 */
export const PageView = memo(function PageView({
  docId,
  page,
  size,
  box,
  rotation,
  revision,
  dark,
  zoom,
  renderZoom,
  devicePixelRatio,
  visible,
  children,
}: PageViewProps) {
  const { t } = useTranslation();
  const w0 = size.widthPt * zoom * PT_TO_CSS;
  const h0 = size.heightPt * zoom * PT_TO_CSS;

  const scaleMilli = scaleToMilli(renderZoom * PT_TO_CSS * devicePixelRatio);
  const { width: pw, height: ph } = pagePixelSize(size, milliToScale(scaleMilli));
  // CSS px per rendered pixel (1 / dpr when the zoom has settled).
  const fx = w0 / pw;
  const fy = h0 / ph;

  // A low-resolution image of the whole page (one tile) sits under the full tiles, so the page is
  // never blank while scrolling.
  const lowMilli = placeholderMilli(size, scaleMilli);

  const content = boxToContent(visible, rotation, w0, h0);
  const tiles = tilesInRect(pw, ph, {
    x: content.x / fx - TILE_PREFETCH_PX,
    y: content.y / fy - TILE_PREFETCH_PX,
    w: content.w / fx + TILE_PREFETCH_PX * 2,
    h: content.h / fy + TILE_PREFETCH_PX * 2,
  });

  return (
    <div
      role="img"
      aria-label={t("viewer.pageLabel", { page: page + 1 })}
      data-page={page}
      className="absolute overflow-hidden bg-paper shadow-page"
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          width: w0,
          height: h0,
          transform: contentTransform(rotation, w0, h0),
          transformOrigin: "0 0",
        }}
      >
        {lowMilli < scaleMilli ? (
          <TileImage
            key={`low-${lowMilli}`}
            src={tileUrl({
              docId,
              page,
              scaleMilli: lowMilli,
              tileX: 0,
              tileY: 0,
              rev: revision,
              dark,
            })}
            className="pointer-events-none absolute inset-0 size-full select-none"
          />
        ) : null}
        {tiles.map((tile) => (
          <TileImage
            key={`${scaleMilli}-${tile.tileX}-${tile.tileY}`}
            src={tileUrl({
              docId,
              page,
              scaleMilli,
              tileX: tile.tileX,
              tileY: tile.tileY,
              rev: revision,
              dark,
            })}
            className="pointer-events-none absolute select-none"
            style={{
              left: tile.x * fx,
              top: tile.y * fy,
              width: tile.width * fx,
              height: tile.height * fy,
            }}
          />
        ))}
        {children}
      </div>
    </div>
  );
});

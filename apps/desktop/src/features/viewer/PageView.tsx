import {
  milliToScale,
  pagePixelSize,
  scaleToMilli,
  tilesForPage,
  tileUrl,
  type PagePoints,
} from "@/lib/tiles";

export interface PageViewProps {
  docId: number;
  /** Zero-based page index. */
  page: number;
  size: PagePoints;
  revision: number;
  /** 1 = 100%. */
  zoom: number;
  devicePixelRatio: number;
}

/**
 * One PDF page drawn from `lumora://` tiles. Tiles are rendered at zoom × devicePixelRatio and
 * shown at 1 image pixel per device pixel, so text stays sharp at every zoom.
 */
export function PageView({ docId, page, size, revision, zoom, devicePixelRatio }: PageViewProps) {
  const scaleMilli = scaleToMilli(zoom * devicePixelRatio);
  const { width, height } = pagePixelSize(size, milliToScale(scaleMilli));
  const tiles = tilesForPage(width, height);
  const toCss = (px: number) => px / devicePixelRatio;

  return (
    <div
      role="img"
      aria-label={`Page ${page + 1}`}
      className="relative flex-none overflow-hidden bg-paper shadow-page"
      style={{ width: toCss(width), height: toCss(height) }}
    >
      {tiles.map((t) => (
        <img
          key={`${scaleMilli}-${t.tileX}-${t.tileY}`}
          src={tileUrl({
            docId,
            page,
            scaleMilli,
            tileX: t.tileX,
            tileY: t.tileY,
            rev: revision,
            dark: false,
          })}
          alt=""
          draggable={false}
          decoding="async"
          className="pointer-events-none absolute select-none"
          style={{
            left: toCss(t.x),
            top: toCss(t.y),
            width: toCss(t.width),
            height: toCss(t.height),
          }}
        />
      ))}
    </div>
  );
}

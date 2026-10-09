import { createPortal } from "react-dom";
import type { OpenDocument } from "@/lib/ipc";
import { printPageUrl, printScaleMilli } from "./printImages";

/** Page images requested ahead of the ones still loading. */
const IN_FLIGHT = 2;

export interface PrintPagesProps {
  doc: OpenDocument;
  /** Zero-based pages, in print order. */
  pages: number[];
  /** Pages loaded so far; the next ones are requested as these finish. */
  loaded: number;
  onLoad: () => void;
  onError: (page: number) => void;
}

/**
 * The pages to print, as full-page images at print resolution, in a container that only the print
 * stylesheet shows (see `#lumora-print` in index.css). Images are requested a few at a time so
 * the viewer's own tiles keep rendering.
 */
export function PrintPages({ doc, pages, loaded, onLoad, onError }: PrintPagesProps) {
  return createPortal(
    <div id="lumora-print">
      {pages.slice(0, loaded + IN_FLIGHT).map((page) => {
        const size = doc.pageSizes[page] ?? doc.pageSizes[0];
        if (!size) return null;
        return (
          <img
            key={page}
            alt=""
            src={printPageUrl({
              docId: doc.id,
              page,
              scaleMilli: printScaleMilli(size),
              rev: doc.revision,
            })}
            style={{ width: `${size.widthPt}pt`, height: `${size.heightPt}pt` }}
            onLoad={onLoad}
            onError={() => {
              onError(page);
            }}
          />
        );
      })}
    </div>,
    document.body,
  );
}

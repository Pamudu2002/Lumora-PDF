import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { OpenDocument } from "@/lib/ipc";
import { cn } from "@/lib/cn";
import { thumbnailUrl } from "@/lib/tiles";
import { useDevicePixelRatio } from "@/lib/useDevicePixelRatio";
import { useDocView, useViewerStore } from "@/stores/viewer";
import { THUMB_W, layoutThumbs, thumbMaxPx, thumbsInRange } from "./thumbLayout";

export interface ThumbnailsPanelProps {
  doc: OpenDocument;
}

/** A virtualized column of page thumbnails; the current page is highlighted. */
export function ThumbnailsPanel({ doc }: ThumbnailsPanelProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, height: 0 });
  const dpr = useDevicePixelRatio();
  const { currentPage } = useDocView(doc.id);
  const goToPage = useViewerStore((s) => s.goToPage);
  const layout = useMemo(() => layoutThumbs(doc.pageSizes), [doc.pageSizes]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      setScroll({ top: el.scrollTop, height: el.clientHeight });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(schedule);
    read();
    el.addEventListener("scroll", schedule, { passive: true });
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Keep the current page's thumbnail in view as the reader moves through the document.
  useEffect(() => {
    const el = scrollRef.current;
    const item = layout.items[currentPage];
    if (!el || !item) return;
    if (item.top < el.scrollTop || item.top + item.height > el.scrollTop + el.clientHeight) {
      el.scrollTop = item.top - (el.clientHeight - item.height) / 2;
    }
  }, [currentPage, layout]);

  const visible = thumbsInRange(layout, scroll.top - scroll.height, scroll.top + scroll.height * 2);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="relative" style={{ height: layout.height }}>
        {visible.map((page) => {
          const item = layout.items[page];
          if (!item) return null;
          const current = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              aria-label={t("viewer.pageLabel", { page: page + 1 })}
              aria-current={current ? "page" : undefined}
              className="group absolute left-1/2 flex -translate-x-1/2 cursor-pointer flex-col items-center gap-1.5 border-0 bg-transparent p-0"
              style={{ top: item.top, width: THUMB_W }}
              onClick={() => {
                goToPage(doc.id, page);
              }}
            >
              <span
                className={cn(
                  "block w-full bg-paper shadow-page",
                  current
                    ? "outline-2 outline-offset-3 outline-brand"
                    : "group-hover:outline-1 group-hover:outline-offset-3 group-hover:outline-line-strong",
                )}
                style={{ height: item.imageHeight }}
              >
                <img
                  src={thumbnailUrl({
                    docId: doc.id,
                    page,
                    maxPx: thumbMaxPx(item.imageHeight, dpr),
                    rev: doc.revision,
                  })}
                  alt=""
                  draggable={false}
                  decoding="async"
                  loading="lazy"
                  className="block size-full select-none"
                />
              </span>
              <span
                className={cn(
                  "rounded-sm px-1.5 text-caption tabular-nums",
                  current ? "bg-selected font-semibold text-brand" : "text-ink-muted",
                )}
              >
                {page + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { setVisiblePages, type OpenDocument } from "@/lib/ipc";
import { useDevicePixelRatio } from "@/lib/useDevicePixelRatio";
import { AUTO_ZOOM_MAX, clampZoom, useDocView, useViewerStore } from "@/stores/viewer";
import {
  PAGE_GAP,
  PT_TO_CSS,
  anchorAt,
  anchorPosition,
  currentPageAt,
  fitPageZoom,
  fitWidthZoom,
  layoutPages,
  pagesInRange,
  singlePageLayout,
  type DocLayout,
} from "./layout";
import { PageView } from "./PageView";
import { textLayerSelection } from "./textCopy";
import { TextLayer } from "./TextLayer";
import { contentToBox } from "./rotation";

/** Zoom change per pixel of Ctrl+wheel / pinch movement. */
const WHEEL_ZOOM_SPEED = 0.0025;

/** Single-page mode: after turning the page with the wheel, ignore further wheel turns this long. */
const PAGE_TURN_COOLDOWN_MS = 350;

/** After a zoom change this quiet, the next one re-renders tiles straight away. */
const ZOOM_SETTLE_MS = 160;

interface Viewport {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface DocumentViewProps {
  doc: OpenDocument;
  dark: boolean;
}

/** The scrollable document: lays out every page but mounts only those near the viewport. */
export function DocumentView({ doc, dark }: DocumentViewProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Scroll position as of the last scroll event (read before a re-layout clamps it). */
  const lastScroll = useRef({ top: 0, left: 0 });
  const [viewport, setViewport] = useState<Viewport>({ top: 0, left: 0, width: 0, height: 0 });
  const dpr = useDevicePixelRatio();
  const view = useDocView(doc.id);
  const setFitZoom = useViewerStore((s) => s.setFitZoom);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const consumeZoomAnchor = useViewerStore((s) => s.consumeZoomAnchor);
  const zoomBy = useViewerStore((s) => s.zoomBy);
  const goToPage = useViewerStore((s) => s.goToPage);
  const scrollRequest = useViewerStore((s) => s.scrollRequest);

  const sizes = doc.pageSizes;
  const { zoomMode, layout: mode, coverPage, rotation, currentPage } = view;
  const { width: vw, height: vh } = viewport;

  // Fit modes are computed while rendering, so the first paint is already at the right zoom.
  const zoom = useMemo(() => {
    if (zoomMode === "custom" || vw === 0) return view.zoom;
    const opts = { mode, coverPage, rotation };
    const fit =
      zoomMode === "fitPage"
        ? fitPageZoom(sizes, opts, vw, vh, currentPage)
        : fitWidthZoom(sizes, opts, vw);
    return clampZoom(zoomMode === "auto" ? Math.min(fit, AUTO_ZOOM_MAX) : fit);
  }, [zoomMode, view.zoom, sizes, mode, coverPage, rotation, vw, vh, currentPage]);

  useEffect(() => {
    if (zoomMode !== "custom") setFitZoom(doc.id, zoom);
  }, [zoomMode, zoom, doc.id, setFitZoom]);

  // Single-page mode lays out only the current page; other modes don't depend on it.
  const singlePage = mode === "single" ? currentPage : -1;
  const layout = useMemo(
    () =>
      singlePage >= 0
        ? singlePageLayout(sizes, singlePage, { zoom, rotation, viewportWidth: vw })
        : layoutPages(sizes, { zoom, mode, coverPage, rotation, viewportWidth: vw }),
    [sizes, singlePage, zoom, mode, coverPage, rotation, vw],
  );

  // Tiles follow the zoom immediately after a pause, or once a gesture settles.
  const [renderZoom, setRenderZoom] = useState(zoom);
  const lastZoomChange = useRef(0);
  useEffect(() => {
    if (renderZoom === zoom) return undefined;
    const now = performance.now();
    const quiet = now - lastZoomChange.current > ZOOM_SETTLE_MS * 2;
    lastZoomChange.current = now;
    const timer = setTimeout(
      () => {
        setRenderZoom(zoom);
      },
      quiet ? 0 : ZOOM_SETTLE_MS,
    );
    return () => {
      clearTimeout(timer);
    };
  }, [zoom, renderZoom]);

  // Track the viewport: scroll position and size.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    let frame = 0;
    const read = () => {
      frame = 0;
      setViewport({
        top: el.scrollTop,
        left: el.scrollLeft,
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    const onScroll = () => {
      lastScroll.current = { top: el.scrollTop, left: el.scrollLeft };
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = new ResizeObserver(() => {
      if (!frame) frame = requestAnimationFrame(read);
    });
    read();
    el.addEventListener("scroll", onScroll, { passive: true });
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  // Ctrl+wheel and touchpad pinch (which WebView2 reports as Ctrl+wheel) zoom around the cursor.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const pixels =
        e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      zoomBy(doc.id, Math.exp(-pixels * WHEEL_ZOOM_SPEED), {
        clientX: e.clientX,
        clientY: e.clientY,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [doc.id, zoomBy]);

  // Single-page mode: scrolling past the bottom (top) of the page turns to the next (previous) one.
  const lastTurn = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || singlePage < 0) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.deltaY === 0) return;
      const now = performance.now();
      if (now - lastTurn.current < PAGE_TURN_COOLDOWN_MS) return;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      const atTop = el.scrollTop <= 0;
      if (e.deltaY > 0 && atBottom && singlePage < sizes.length - 1) {
        lastTurn.current = now;
        goToPage(doc.id, singlePage + 1);
      } else if (e.deltaY < 0 && atTop && singlePage > 0) {
        lastTurn.current = now;
        goToPage(doc.id, singlePage - 1, { y: sizes[singlePage - 1]?.heightPt ?? 0 });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [doc.id, singlePage, sizes, goToPage]);

  // Keep the point under the cursor (or the viewport centre) fixed when the geometry changes.
  const previous = useRef<{ layout: DocLayout; key: string; measured: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const key = `${zoom}|${mode}|${coverPage}|${rotation}`;
    const prev = previous.current;
    previous.current = { layout, key, measured: vw > 0 };
    // The first measured layout (fit zoom applied on open) keeps the document at the top.
    if (!el || !prev || !prev.measured || prev.key === key) return;
    const anchorClient = consumeZoomAnchor(doc.id);
    const bounds = el.getBoundingClientRect();
    const ax = anchorClient ? anchorClient.clientX - bounds.left : el.clientWidth / 2;
    const ay = anchorClient ? anchorClient.clientY - bounds.top : el.clientHeight / 2;
    const anchor = anchorAt(prev.layout, lastScroll.current.left + ax, lastScroll.current.top + ay);
    if (!anchor) return;
    const pos = anchorPosition(layout, anchor);
    if (!pos) return;
    el.scrollLeft = pos.x - ax;
    el.scrollTop = pos.y - ay;
    lastScroll.current = { top: el.scrollTop, left: el.scrollLeft };
  }, [layout, zoom, mode, coverPage, rotation, vw, doc.id, consumeZoomAnchor]);

  // Go-to-page requests (page input, thumbnails, outline, links, search).
  const handledRequest = useRef(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollRequest || scrollRequest.docId !== doc.id || vw === 0) return;
    if (handledRequest.current === scrollRequest.nonce) return;
    handledRequest.current = scrollRequest.nonce;
    const box = layout.pages[scrollRequest.page];
    const size = sizes[scrollRequest.page];
    if (!box || !size) return;
    if (scrollRequest.y === undefined) {
      el.scrollTop = box.y - PAGE_GAP;
    } else {
      const scale = zoom * PT_TO_CSS;
      const w0 = size.widthPt * scale;
      const h0 = size.heightPt * scale;
      const p = contentToBox(
        (scrollRequest.x ?? 0) * scale,
        scrollRequest.y * scale,
        rotation,
        w0,
        h0,
      );
      el.scrollTop = box.y + p.y - el.clientHeight * 0.3;
      if (scrollRequest.x !== undefined) el.scrollLeft = box.x + p.x - el.clientWidth / 2;
    }
    lastScroll.current = { top: el.scrollTop, left: el.scrollLeft };
  }, [scrollRequest, layout, sizes, zoom, rotation, doc.id, vw]);

  // Report the page the reader is on.
  useEffect(() => {
    if (vh === 0) return;
    setCurrentPage(doc.id, currentPageAt(layout, viewport.top, vh));
  }, [layout, viewport.top, vh, doc.id, setCurrentPage]);

  const overscan = vh;
  const mounted =
    vw === 0 ? [] : pagesInRange(layout, viewport.top - overscan, viewport.top + vh + overscan);

  // Tell the renderer which pages are mounted (only when the set changes).
  const mountedKey = mounted.join(",");
  useEffect(() => {
    if (mountedKey === "") return undefined;
    const pages = mountedKey.split(",").map(Number);
    const timer = setTimeout(() => {
      void setVisiblePages(doc.id, pages).catch(() => undefined);
    }, 30);
    return () => {
      clearTimeout(timer);
    };
  }, [doc.id, mountedKey]);

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      data-document-view={doc.id}
      onCopy={(e) => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const text = textLayerSelection(selection.getRangeAt(0), e.currentTarget);
        if (text === null) return;
        e.preventDefault();
        e.clipboardData.setData("text/plain", text);
      }}
      aria-label={t("viewer.document")}
      className="absolute inset-0 overflow-x-auto overflow-y-scroll bg-canvas outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
    >
      {sizes.length === 0 ? (
        <p className="m-0 p-8 text-center text-caption text-ink-muted">{t("viewer.noPages")}</p>
      ) : (
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          {mounted.map((page) => {
            const box = layout.pages[page];
            const size = sizes[page];
            if (!box || !size) return null;
            return (
              <PageView
                key={page}
                docId={doc.id}
                page={page}
                size={size}
                box={box}
                rotation={rotation}
                revision={doc.revision}
                dark={dark}
                zoom={zoom}
                renderZoom={renderZoom}
                devicePixelRatio={dpr}
                visible={{
                  x: viewport.left - box.x,
                  y: viewport.top - box.y,
                  w: vw,
                  h: vh,
                }}
              >
                <TextLayer
                  docId={doc.id}
                  page={page}
                  revision={doc.revision}
                  scale={zoom * PT_TO_CSS}
                />
              </PageView>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { setVisiblePages, type OpenDocument } from "@/lib/ipc";
import { useDevicePixelRatio } from "@/lib/useDevicePixelRatio";
import { useSettingsStore } from "@/stores/settings";
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
import { LinkLayer } from "./LinkLayer";
import { PageView } from "./PageView";
import { SearchHighlights } from "./SearchHighlights";
import { textLayerSelection } from "./textCopy";
import { TextLayer } from "./TextLayer";
import { contentToBox } from "./rotation";

/** Zoom change per pixel of Ctrl+wheel / pinch movement. */
const WHEEL_ZOOM_SPEED = 0.0025;

/** Single-page mode: after turning the page with the wheel, ignore further wheel turns this long. */
const PAGE_TURN_COOLDOWN_MS = 350;
/** A point closer than this to the top or bottom edge counts as hidden (under the floating bars). */
const REVEAL_MARGIN_TOP = 64;
const REVEAL_MARGIN_BOTTOM = 80;

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
  /** Viewport size as last measured, and the latest layout, for saving the position on unmount. */
  const viewSize = useRef({ width: 0, height: 0 });
  const latestLayout = useRef<DocLayout | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ top: 0, left: 0, width: 0, height: 0 });
  const dpr = useDevicePixelRatio();
  const view = useDocView(doc.id);
  const setFitZoom = useViewerStore((s) => s.setFitZoom);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const consumeZoomAnchor = useViewerStore((s) => s.consumeZoomAnchor);
  const zoomBy = useViewerStore((s) => s.zoomBy);
  const goToPage = useViewerStore((s) => s.goToPage);
  const scrollRequest = useViewerStore((s) => s.scrollRequest);
  const wheel = useSettingsStore((s) => s.wheel);
  const saveAnchor = useViewerStore((s) => s.saveAnchor);
  const finishScrollRequest = useViewerStore((s) => s.finishScrollRequest);
  const consumeSavedAnchor = useViewerStore((s) => s.consumeSavedAnchor);

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

  // After scrolling from code, record the position and update the viewport right away instead of
  // on the next scroll event, so effects (current page, mounted pages) don't use the old one.
  const syncScroll = useCallback((el: HTMLDivElement) => {
    lastScroll.current = { top: el.scrollTop, left: el.scrollLeft };
    setViewport({
      top: el.scrollTop,
      left: el.scrollLeft,
      width: el.clientWidth,
      height: el.clientHeight,
    });
  }, []);

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
      viewSize.current = { width: el.clientWidth, height: el.clientHeight };
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
  // With the "mouse wheel zooms" setting it is the other way round: the wheel zooms and
  // Ctrl+wheel scrolls (as in Acrobat).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onWheel = (e: WheelEvent) => {
      const zooms = wheel === "zoom" ? !e.ctrlKey : e.ctrlKey;
      const pixels =
        e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * 800 : e.deltaY;
      if (zooms) {
        e.preventDefault();
        zoomBy(doc.id, Math.exp(-pixels * WHEEL_ZOOM_SPEED), {
          clientX: e.clientX,
          clientY: e.clientY,
        });
      } else if (e.ctrlKey) {
        // Ctrl+wheel would zoom the whole WebView; scroll the document instead.
        e.preventDefault();
        el.scrollTop += pixels;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [doc.id, zoomBy, wheel]);

  // Single-page mode: scrolling past the bottom (top) of the page turns to the next (previous) one.
  const lastTurn = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || singlePage < 0) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.deltaY === 0 || wheel === "zoom") return;
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
  }, [doc.id, singlePage, sizes, goToPage, wheel]);

  // Keep the point under the cursor (or the viewport centre) fixed when the geometry changes.
  const previous = useRef<{ layout: DocLayout; key: string; measured: boolean } | null>(null);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const key = `${zoom}|${mode}|${coverPage}|${rotation}`;
    const prev = previous.current;
    previous.current = { layout, key, measured: vw > 0 };
    // Only a measured layout is worth saving (React may unmount once before the first measure).
    if (vw > 0) latestLayout.current = layout;
    // The first measured layout goes back to where the reader left this document (switching tabs)
    // or stays at the top (just opened).
    if (el && vw > 0 && !prev?.measured) {
      const saved = consumeSavedAnchor(doc.id);
      const pos = saved ? anchorPosition(layout, saved) : null;
      if (pos) {
        el.scrollLeft = pos.x - el.clientWidth / 2;
        el.scrollTop = pos.y - el.clientHeight / 2;
        syncScroll(el);
      }
      return;
    }
    if (!el || !prev || prev.key === key) return;
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
    syncScroll(el);
  }, [
    layout,
    zoom,
    mode,
    coverPage,
    rotation,
    vw,
    doc.id,
    consumeZoomAnchor,
    consumeSavedAnchor,
    syncScroll,
  ]);

  // Remember the position (the page point at the viewport centre) when the view goes away.
  useEffect(() => {
    const scroll = lastScroll;
    const size = viewSize;
    const latest = latestLayout;
    return () => {
      const { width, height } = size.current;
      if (!latest.current || width === 0) return;
      const anchor = anchorAt(
        latest.current,
        scroll.current.left + width / 2,
        scroll.current.top + height / 2,
      );
      if (anchor) saveAnchor(doc.id, anchor);
    };
  }, [doc.id, saveAnchor]);

  // Go-to-page requests (page input, thumbnails, outline, links, search).
  const handledRequest = useRef(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !scrollRequest || scrollRequest.docId !== doc.id || vw === 0) return;
    if (handledRequest.current === scrollRequest.nonce) return;
    handledRequest.current = scrollRequest.nonce;
    finishScrollRequest(scrollRequest.nonce);
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
      const tx = box.x + p.x;
      const ty = box.y + p.y;
      // Leave room for the find bar at the top and the zoom bar at the bottom.
      const shown =
        ty >= el.scrollTop + REVEAL_MARGIN_TOP &&
        ty <= el.scrollTop + el.clientHeight - REVEAL_MARGIN_BOTTOM &&
        tx >= el.scrollLeft &&
        tx <= el.scrollLeft + el.clientWidth;
      if (scrollRequest.ifHidden && shown) return;
      el.scrollTop = ty - el.clientHeight * 0.3;
      if (scrollRequest.x !== undefined) el.scrollLeft = tx - el.clientWidth / 2;
    }
    syncScroll(el);
  }, [scrollRequest, layout, sizes, zoom, rotation, doc.id, vw, finishScrollRequest, syncScroll]);

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
                <SearchHighlights docId={doc.id} page={page} scale={zoom * PT_TO_CSS} dark={dark} />
                <TextLayer
                  docId={doc.id}
                  page={page}
                  revision={doc.revision}
                  scale={zoom * PT_TO_CSS}
                />
                <LinkLayer
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

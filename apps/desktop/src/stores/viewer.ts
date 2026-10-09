import { create } from "zustand";
import type { LayoutMode, Rotation } from "@/features/viewer/layout";

/** Zoom presets (1 = 100%) for the zoom buttons and Ctrl+= / Ctrl+-. */
export const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
/** Continuous zoom (Ctrl+wheel, pinch) range. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6.4;
/** "Auto" zoom fits the page width but never goes above this. */
export const AUTO_ZOOM_MAX = 1.25;

/**
 * - custom: a fixed zoom
 * - fitWidth / fitPage: follow the window size
 * - auto: fit width, at most 125%
 */
export type ZoomMode = "custom" | "fitWidth" | "fitPage" | "auto";

/** How one document is shown. */
export interface DocView {
  /** Effective zoom, 1 = 100%. Kept up to date for fit modes too. */
  zoom: number;
  zoomMode: ZoomMode;
  layout: LayoutMode;
  coverPage: boolean;
  rotation: Rotation;
  /** Zero-based page the reader is on. */
  currentPage: number;
}

/** A point in the viewport (client coordinates) to keep fixed while zooming. */
export interface ZoomAnchor {
  clientX: number;
  clientY: number;
}

/** A one-off request to scroll a document to a page (and optionally a point on it). */
export interface ScrollRequest {
  docId: number;
  page: number;
  /** Distance from the top of the page, in display points. */
  y?: number;
  /** Distance from the left of the page, in display points. */
  x?: number;
  /** Only scroll when the point is outside the viewport. */
  ifHidden?: boolean;
  nonce: number;
}

export const DEFAULT_VIEW: DocView = {
  zoom: 1,
  zoomMode: "auto",
  layout: "continuous",
  coverPage: false,
  rotation: 0,
  currentPage: 0,
};

interface ViewerState {
  views: Record<number, DocView>;
  zoomAnchor: { docId: number; anchor: ZoomAnchor } | null;
  scrollRequest: ScrollRequest | null;
  init: (docId: number, initial?: Partial<DocView>) => void;
  remove: (docId: number) => void;
  setZoom: (docId: number, zoom: number, anchor?: ZoomAnchor) => void;
  zoomBy: (docId: number, factor: number, anchor?: ZoomAnchor) => void;
  zoomStep: (docId: number, dir: 1 | -1) => void;
  setZoomMode: (docId: number, mode: ZoomMode) => void;
  /** Updates the effective zoom of a fit mode without leaving it. */
  setFitZoom: (docId: number, zoom: number) => void;
  setLayout: (docId: number, layout: LayoutMode) => void;
  setCoverPage: (docId: number, coverPage: boolean) => void;
  rotate: (docId: number, dir: 1 | -1) => void;
  setCurrentPage: (docId: number, page: number) => void;
  goToPage: (
    docId: number,
    page: number,
    at?: { x?: number; y?: number; ifHidden?: boolean },
  ) => void;
  consumeZoomAnchor: (docId: number) => ZoomAnchor | null;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The next preset above (`dir` 1) or below (`dir` -1) the current zoom. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const next =
    dir === 1
      ? ZOOM_PRESETS.find((z) => z > zoom + 1e-6)
      : [...ZOOM_PRESETS].reverse().find((z) => z < zoom - 1e-6);
  return next ?? (dir === 1 ? Math.min(MAX_ZOOM, zoom) : Math.max(MIN_ZOOM, zoom));
}

let nonce = 0;

export const useViewerStore = create<ViewerState>()((set, get) => {
  const update = (docId: number, patch: Partial<DocView>) => {
    set((s) => ({
      views: { ...s.views, [docId]: { ...(s.views[docId] ?? DEFAULT_VIEW), ...patch } },
    }));
  };
  const view = (docId: number) => get().views[docId] ?? DEFAULT_VIEW;

  return {
    views: {},
    zoomAnchor: null,
    scrollRequest: null,

    init: (docId, initial) => {
      if (get().views[docId]) return;
      update(docId, { ...DEFAULT_VIEW, ...initial });
    },
    remove: (docId) => {
      set((s) => ({
        views: Object.fromEntries(Object.entries(s.views).filter(([id]) => Number(id) !== docId)),
      }));
    },
    setZoom: (docId, zoom, anchor) => {
      if (anchor) set({ zoomAnchor: { docId, anchor } });
      update(docId, { zoom: clampZoom(zoom), zoomMode: "custom" });
    },
    zoomBy: (docId, factor, anchor) => {
      get().setZoom(docId, view(docId).zoom * factor, anchor);
    },
    zoomStep: (docId, dir) => {
      get().setZoom(docId, stepZoom(view(docId).zoom, dir));
    },
    setZoomMode: (docId, mode) => {
      update(docId, { zoomMode: mode });
    },
    setFitZoom: (docId, zoom) => {
      if (Math.abs(view(docId).zoom - zoom) > 1e-4) update(docId, { zoom });
    },
    setLayout: (docId, layout) => {
      update(docId, { layout });
    },
    setCoverPage: (docId, coverPage) => {
      update(docId, { coverPage });
    },
    rotate: (docId, dir) => {
      const r = (view(docId).rotation + dir * 90 + 360) % 360;
      update(docId, { rotation: r as Rotation });
    },
    setCurrentPage: (docId, page) => {
      if (view(docId).currentPage !== page) update(docId, { currentPage: page });
    },
    goToPage: (docId, page, at) => {
      nonce += 1;
      set({ scrollRequest: { docId, page, ...at, nonce } });
      update(docId, { currentPage: page });
    },
    consumeZoomAnchor: (docId) => {
      const pending = get().zoomAnchor;
      if (!pending || pending.docId !== docId) return null;
      set({ zoomAnchor: null });
      return pending.anchor;
    },
  };
});

/** The view of one document (defaults until initialised). */
export function useDocView(docId: number): DocView {
  return useViewerStore((s) => s.views[docId] ?? DEFAULT_VIEW);
}

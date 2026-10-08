import { create } from "zustand";

/** Zoom presets (1 = 100%). Ctrl+= / Ctrl+- step through them. */
export const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;
export const MIN_ZOOM = ZOOM_PRESETS[0];
export const MAX_ZOOM = ZOOM_PRESETS[ZOOM_PRESETS.length - 1] ?? 4;

interface ViewerState {
  zoom: number;
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The next preset above (`dir` 1) or below (`dir` -1) the current zoom. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const next =
    dir === 1
      ? ZOOM_PRESETS.find((z) => z > zoom + 1e-6)
      : [...ZOOM_PRESETS].reverse().find((z) => z < zoom - 1e-6);
  return clampZoom(next ?? zoom);
}

/** View state of the open document. Fit modes and per-file zoom memory arrive in Phase 1. */
export const useViewerStore = create<ViewerState>()((set) => ({
  zoom: 1,
  setZoom: (zoom) => {
    set({ zoom: clampZoom(zoom) });
  },
  zoomIn: () => {
    set((s) => ({ zoom: stepZoom(s.zoom, 1) }));
  },
  zoomOut: () => {
    set((s) => ({ zoom: stepZoom(s.zoom, -1) }));
  },
  resetZoom: () => {
    set({ zoom: 1 });
  },
}));

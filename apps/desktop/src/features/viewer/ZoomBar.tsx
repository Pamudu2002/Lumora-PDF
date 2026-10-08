import { ZoomIn, ZoomOut } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { MAX_ZOOM, MIN_ZOOM, useViewerStore } from "@/stores/viewer";

export interface ZoomBarProps {
  pageCount: number;
}

/** The floating bar centered above the canvas bottom: page count and zoom. */
export function ZoomBar({ pageCount }: ZoomBarProps) {
  const zoom = useViewerStore((s) => s.zoom);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const resetZoom = useViewerStore((s) => s.resetZoom);

  return (
    <div className="absolute bottom-4 left-1/2 flex h-10 -translate-x-1/2 items-center gap-0.5 rounded-pill border border-line bg-surface-raised px-1 shadow-popover">
      <span className="px-2 text-label text-ink-muted">
        {pageCount === 1 ? "1 page" : `${pageCount} pages`}
      </span>
      <span aria-hidden className="mx-1.5 h-5 w-px flex-none bg-line" />
      <IconButton
        size="sm"
        className="rounded-pill"
        label="Zoom out"
        shortcut="Ctrl+-"
        icon={<ZoomOut size={16} strokeWidth={1.75} />}
        disabled={zoom <= MIN_ZOOM}
        onClick={zoomOut}
      />
      <Tooltip label="Actual size" shortcut="Ctrl+0">
        <button
          type="button"
          aria-label={`Zoom level ${Math.round(zoom * 100)}%. Reset to 100%`}
          className="h-control-sm min-w-[52px] cursor-pointer rounded-pill border-0 bg-transparent px-2 text-label text-ink hover:bg-surface-sunken"
          onClick={resetZoom}
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tooltip>
      <IconButton
        size="sm"
        className="rounded-pill"
        label="Zoom in"
        shortcut="Ctrl+="
        icon={<ZoomIn size={16} strokeWidth={1.75} />}
        disabled={zoom >= MAX_ZOOM}
        onClick={zoomIn}
      />
    </div>
  );
}

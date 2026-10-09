import { ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { MAX_ZOOM, MIN_ZOOM, useDocView, useViewerStore } from "@/stores/viewer";

export interface ZoomBarProps {
  docId: number;
  pageCount: number;
}

/** The floating bar centered above the bottom of the canvas: page and zoom controls. */
export function ZoomBar({ docId, pageCount }: ZoomBarProps) {
  const { t } = useTranslation();
  const { zoom, currentPage } = useDocView(docId);
  const zoomStep = useViewerStore((s) => s.zoomStep);
  const setZoom = useViewerStore((s) => s.setZoom);
  const percent = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-4 left-1/2 flex h-10 -translate-x-1/2 items-center gap-0.5 rounded-pill border border-line bg-surface-raised px-1 shadow-popover">
      <span className="px-2 text-label text-ink-muted tabular-nums">
        {currentPage + 1} / {pageCount}
      </span>
      <span aria-hidden className="mx-1.5 h-5 w-px flex-none bg-line" />
      <IconButton
        size="sm"
        className="rounded-pill"
        label={t("zoom.zoomOut")}
        shortcut="Ctrl+-"
        icon={<ZoomOut size={16} strokeWidth={1.75} />}
        disabled={zoom <= MIN_ZOOM + 1e-6}
        onClick={() => {
          zoomStep(docId, -1);
        }}
      />
      <Tooltip label={t("zoom.actualSize")} shortcut="Ctrl+0">
        <button
          type="button"
          aria-label={t("zoom.level", { percent })}
          className="h-control-sm min-w-13 cursor-pointer rounded-pill border-0 bg-transparent px-2 text-label text-ink tabular-nums hover:bg-surface-sunken"
          onClick={() => {
            setZoom(docId, 1);
          }}
        >
          {percent}%
        </button>
      </Tooltip>
      <IconButton
        size="sm"
        className="rounded-pill"
        label={t("zoom.zoomIn")}
        shortcut="Ctrl+="
        icon={<ZoomIn size={16} strokeWidth={1.75} />}
        disabled={zoom >= MAX_ZOOM - 1e-6}
        onClick={() => {
          zoomStep(docId, 1);
        }}
      />
    </div>
  );
}

import { MoveHorizontal, ZoomIn, ZoomOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/Menu";
import { PageInput } from "./PageInput";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_PRESETS, useDocView, useViewerStore } from "@/stores/viewer";

const ICON = { size: 16, strokeWidth: 1.75 } as const;

export interface ZoomBarProps {
  docId: number;
  pageCount: number;
}

/** The floating bar centered above the bottom of the canvas: page and zoom controls. */
export function ZoomBar({ docId, pageCount }: ZoomBarProps) {
  const { t } = useTranslation();
  const { zoom, zoomMode } = useDocView(docId);
  const zoomStep = useViewerStore((s) => s.zoomStep);
  const setZoom = useViewerStore((s) => s.setZoom);
  const setZoomMode = useViewerStore((s) => s.setZoomMode);
  const percent = Math.round(zoom * 100);

  return (
    <div className="absolute bottom-4 left-1/2 flex h-10 -translate-x-1/2 items-center gap-0.5 rounded-pill border border-line bg-surface-raised px-1 shadow-popover">
      <PageInput docId={docId} pageCount={pageCount} />
      <span aria-hidden className="mx-1.5 h-5 w-px flex-none bg-line" />
      <IconButton
        size="sm"
        className="rounded-pill"
        label={t("zoom.zoomOut")}
        shortcut="Ctrl+-"
        icon={<ZoomOut {...ICON} />}
        disabled={zoom <= MIN_ZOOM + 1e-6}
        onClick={() => {
          zoomStep(docId, -1);
        }}
      />
      <Menu
        side="top"
        align="center"
        trigger={
          <button
            type="button"
            aria-label={t("zoom.level", { percent })}
            className="h-control-sm min-w-13 cursor-pointer rounded-pill border-0 bg-transparent px-2 text-label text-ink tabular-nums hover:bg-surface-sunken"
          >
            {t("zoom.percent", { percent })}
          </button>
        }
      >
        {ZOOM_PRESETS.map((preset) => (
          <MenuItem
            key={preset}
            checked={zoomMode === "custom" && Math.abs(zoom - preset) < 1e-6}
            shortcut={preset === 1 ? "Ctrl+0" : undefined}
            onSelect={() => {
              setZoom(docId, preset);
            }}
          >
            {t("zoom.percent", { percent: Math.round(preset * 100) })}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem
          checked={zoomMode === "fitWidth"}
          shortcut="Ctrl+2"
          onSelect={() => {
            setZoomMode(docId, "fitWidth");
          }}
        >
          {t("zoom.fitWidth")}
        </MenuItem>
        <MenuItem
          checked={zoomMode === "fitPage"}
          shortcut="Ctrl+1"
          onSelect={() => {
            setZoomMode(docId, "fitPage");
          }}
        >
          {t("zoom.fitPage")}
        </MenuItem>
      </Menu>
      <IconButton
        size="sm"
        className="rounded-pill"
        label={t("zoom.zoomIn")}
        shortcut="Ctrl+="
        icon={<ZoomIn {...ICON} />}
        disabled={zoom >= MAX_ZOOM - 1e-6}
        onClick={() => {
          zoomStep(docId, 1);
        }}
      />
      <span aria-hidden className="mx-1.5 h-5 w-px flex-none bg-line" />
      <IconButton
        size="sm"
        className="rounded-pill"
        label={t("zoom.fitWidth")}
        shortcut="Ctrl+2"
        icon={<MoveHorizontal {...ICON} />}
        active={zoomMode === "fitWidth"}
        onClick={() => {
          setZoomMode(docId, "fitWidth");
        }}
      />
    </div>
  );
}

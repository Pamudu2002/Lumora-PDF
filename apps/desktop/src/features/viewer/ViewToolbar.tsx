import { Maximize, MoveHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { useDocView, useViewerStore } from "@/stores/viewer";

const ICON = { size: 18, strokeWidth: 1.75 } as const;

export interface ViewToolbarProps {
  docId: number;
}

/** The secondary toolbar of the View group: page layout, fit, rotation and display tools. */
export function ViewToolbar({ docId }: ViewToolbarProps) {
  const { t } = useTranslation();
  const { zoomMode } = useDocView(docId);
  const setZoomMode = useViewerStore((s) => s.setZoomMode);

  return (
    <div
      role="toolbar"
      aria-label={t("viewTools.label")}
      className="flex h-subtoolbar flex-none flex-wrap items-center gap-0.5 border-b border-line bg-surface px-2"
    >
      <IconButton
        label={t("zoom.fitWidth")}
        shortcut="Ctrl+2"
        icon={<MoveHorizontal {...ICON} />}
        active={zoomMode === "fitWidth"}
        onClick={() => {
          setZoomMode(docId, "fitWidth");
        }}
      />
      <IconButton
        label={t("zoom.fitPage")}
        shortcut="Ctrl+1"
        icon={<Maximize {...ICON} />}
        active={zoomMode === "fitPage"}
        onClick={() => {
          setZoomMode(docId, "fitPage");
        }}
      />
    </div>
  );
}

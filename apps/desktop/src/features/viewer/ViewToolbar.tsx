import { BookOpen, Maximize, Moon, MoveHorizontal, RotateCcw, RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useSettingsStore } from "@/stores/settings";
import { useDocView, useViewerStore } from "@/stores/viewer";
import type { LayoutMode } from "./layout";

const ICON = { size: 18, strokeWidth: 1.75 } as const;

export interface ViewToolbarProps {
  docId: number;
}

/** The secondary toolbar of the View group: page layout, fit, rotation and display tools. */
export function ViewToolbar({ docId }: ViewToolbarProps) {
  const { t } = useTranslation();
  const { zoomMode, layout, coverPage } = useDocView(docId);
  const setZoomMode = useViewerStore((s) => s.setZoomMode);
  const setLayout = useViewerStore((s) => s.setLayout);
  const setCoverPage = useViewerStore((s) => s.setCoverPage);
  const rotate = useViewerStore((s) => s.rotate);
  const pageDarkMode = useSettingsStore((s) => s.pageDarkMode);
  const setPageDarkMode = useSettingsStore((s) => s.setPageDarkMode);

  const layouts: { value: LayoutMode; label: string }[] = [
    { value: "single", label: t("viewTools.single") },
    { value: "continuous", label: t("viewTools.continuous") },
    { value: "twoPage", label: t("viewTools.twoPage") },
  ];

  return (
    <div
      role="toolbar"
      aria-label={t("viewTools.label")}
      className="flex h-subtoolbar flex-none flex-wrap items-center gap-0.5 border-b border-line bg-surface px-2"
    >
      <SegmentedControl
        label={t("viewTools.layout")}
        value={layout}
        options={layouts}
        onValueChange={(value) => {
          setLayout(docId, value);
        }}
      />
      {layout === "twoPage" ? (
        <IconButton
          className="ml-1"
          label={t("viewTools.coverPage")}
          icon={<BookOpen {...ICON} />}
          active={coverPage}
          onClick={() => {
            setCoverPage(docId, !coverPage);
          }}
        />
      ) : null}
      <span aria-hidden className="mx-1.5 h-5 w-px flex-none bg-line" />
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
      <IconButton
        label={t("viewTools.rotateCounterclockwise")}
        shortcut="Ctrl+Shift+-"
        icon={<RotateCcw {...ICON} />}
        onClick={() => {
          rotate(docId, -1);
        }}
      />
      <IconButton
        label={t("viewTools.rotateClockwise")}
        shortcut="Ctrl+Shift+="
        icon={<RotateCw {...ICON} />}
        onClick={() => {
          rotate(docId, 1);
        }}
      />
      <span aria-hidden className="mx-1.5 h-5 w-px flex-none bg-line" />
      <IconButton
        label={t("viewTools.pageDarkMode")}
        icon={<Moon {...ICON} />}
        active={pageDarkMode}
        onClick={() => {
          setPageDarkMode(!pageDarkMode);
        }}
      />
    </div>
  );
}

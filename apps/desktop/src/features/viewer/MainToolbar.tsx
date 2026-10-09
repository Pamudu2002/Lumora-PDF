import { PanelLeft, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import type { OpenDocument } from "@/lib/ipc";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";

const ICON = { size: 18, strokeWidth: 1.75 } as const;

export interface MainToolbarProps {
  doc: OpenDocument;
}

/** The main toolbar: sidebar toggle, document title, tool groups and window-level actions. */
export function MainToolbar({ doc }: MainToolbarProps) {
  const { t } = useTranslation();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const close = useDocumentsStore((s) => s.close);
  const title = doc.info.title ?? doc.fileName;

  return (
    <nav
      aria-label={t("toolbar.label")}
      className="grid h-toolbar flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-line bg-surface px-2"
    >
      <div className="flex min-w-0 items-center gap-1">
        <IconButton
          label={t("sidebar.toggle")}
          shortcut="F4"
          icon={<PanelLeft {...ICON} />}
          active={sidebarOpen}
          onClick={toggleSidebar}
        />
        <span className="min-w-0 truncate px-2 text-body font-semibold" title={doc.path}>
          {title}
        </span>
      </div>
      <div role="tablist" aria-label={t("toolbar.groups")} className="flex gap-0.5">
        <button
          type="button"
          role="tab"
          aria-selected
          className="h-control cursor-pointer rounded-md border-0 bg-brand-soft px-3 text-body font-semibold text-brand"
        >
          {t("toolbar.view")}
        </button>
      </div>
      <div className="flex items-center justify-end gap-1">
        <IconButton
          label={t("viewer.closeFile")}
          shortcut="Ctrl+W"
          icon={<X {...ICON} />}
          onClick={() => void close()}
        />
      </div>
    </nav>
  );
}

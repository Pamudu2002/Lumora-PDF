import { LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/components/ui/IconButton";
import type { OpenDocument } from "@/lib/ipc";
import { useUiStore, type SidebarTab } from "@/stores/ui";
import { ThumbnailsPanel } from "./ThumbnailsPanel";

const ICON = { size: 18, strokeWidth: 1.75 } as const;

export interface SidebarProps {
  doc: OpenDocument;
}

/** The left sidebar: tab buttons, a heading and the active panel. */
export function Sidebar({ doc }: SidebarProps) {
  const { t } = useTranslation();
  const tab = useUiStore((s) => s.sidebarTab);
  const showTab = useUiStore((s) => s.showSidebarTab);

  const tabs: { id: SidebarTab; label: string; icon: ReactNode }[] = [
    { id: "thumbnails", label: t("sidebar.thumbnails"), icon: <LayoutGrid {...ICON} /> },
  ];
  const active = tabs.some((x) => x.id === tab) ? tab : "thumbnails";

  return (
    <aside
      aria-label={t("sidebar.label")}
      className="flex w-sidebar flex-none flex-col border-r border-line bg-surface-sunken"
    >
      <div role="tablist" className="flex gap-0.5 border-b border-line p-2">
        {tabs.map((x) => (
          <IconButton
            key={x.id}
            role="tab"
            aria-selected={active === x.id}
            label={x.label}
            icon={x.icon}
            active={active === x.id}
            onClick={() => {
              showTab(x.id);
            }}
          />
        ))}
      </div>
      {active === "thumbnails" ? (
        <>
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <h2 className="m-0 text-title font-semibold">{t("sidebar.pages")}</h2>
            <span className="text-caption text-ink-muted">
              {t("viewer.pageCount", { count: doc.info.pageCount })}
            </span>
          </div>
          <ThumbnailsPanel doc={doc} />
        </>
      ) : null}
    </aside>
  );
}

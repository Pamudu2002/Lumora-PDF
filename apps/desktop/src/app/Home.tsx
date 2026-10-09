import { FileUp, FolderOpen, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/cn";
import { listRecentFiles, removeRecentFile, type RecentFile } from "@/lib/ipc";
import { RecentFiles } from "./RecentFiles";
import { useDialogStore } from "@/stores/dialogs";

export interface HomeProps {
  onOpenFile: () => void;
  /** Opens a file from the recent list. */
  onOpenPath: (path: string) => void;
  /** Files are being dragged over the window. */
  dragging: boolean;
  opening: boolean;
}

/** The home screen shown when no document is open: open a file, or pick a recent one. */
export function Home({ onOpenFile, onOpenPath, dragging, opening }: HomeProps) {
  const { t } = useTranslation();
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const showDialog = useDialogStore((s) => s.show);

  useEffect(() => {
    let cancelled = false;
    listRecentFiles()
      .then((files) => {
        if (!cancelled) setRecent(files);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-full justify-center overflow-auto bg-surface px-8 pt-12 pb-8">
      <div className="flex w-full max-w-[1040px] flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display text-display font-medium tracking-[-0.015em] text-ink">
              {recent.length > 0 ? t("home.greetingReturning") : t("home.greeting")}
            </h1>
            <p className="m-0 text-body text-ink-muted">{t("home.promise")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                showDialog("settings");
              }}
            >
              <Settings size={16} strokeWidth={1.75} aria-hidden />
              {t("settings.open")}
            </Button>
            <Button variant="primary" onClick={onOpenFile} disabled={opening}>
              <FolderOpen size={16} strokeWidth={1.75} aria-hidden />
              {t("home.openFile")}
            </Button>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenFile}
          disabled={opening}
          className={cn(
            "flex cursor-pointer flex-col items-start justify-center gap-2.5 rounded-lg border-[1.5px] border-dashed p-5 text-left transition-colors duration-[120ms]",
            dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-sunken",
          )}
        >
          <span className="grid size-10 place-items-center rounded-pill bg-brand-soft text-brand">
            <FileUp size={18} strokeWidth={1.75} aria-hidden />
          </span>
          <span className="text-title font-semibold text-ink">
            {opening ? t("home.opening") : t("home.dropTitle")}
          </span>
          <span className="text-label text-ink-muted">
            {t("home.dropHintBefore")} <Kbd>Ctrl+O</Kbd> {t("home.dropHintAfter")}
          </span>
        </button>

        {recent.length > 0 ? (
          <RecentFiles
            files={recent}
            onOpen={onOpenPath}
            onRemove={(path) => {
              setRecent((files) => files.filter((f) => f.path !== path));
              void removeRecentFile(path).catch(() => undefined);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

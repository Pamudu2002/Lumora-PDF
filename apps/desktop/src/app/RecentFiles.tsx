import { FileText, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";
import { folderLabel, openedWhen } from "@/lib/format";
import type { RecentFile } from "@/lib/ipc";

export interface RecentFilesProps {
  files: RecentFile[];
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
}

/** The recent files table on the home screen. Choosing a row opens the file. */
export function RecentFiles({ files, onOpen, onRemove }: RecentFilesProps) {
  const { t, i18n } = useTranslation();
  const now = new Date();

  const opened = (ms: number) => {
    const when = openedWhen(ms, now, i18n.language);
    if (when.kind === "today") return t("recent.today", { time: when.time });
    if (when.kind === "yesterday") return t("recent.yesterday");
    return when.date;
  };

  return (
    <section aria-labelledby="recent-files-title" className="flex flex-col gap-3">
      <h2 id="recent-files-title" className="m-0 text-title-lg font-semibold text-ink">
        {t("recent.title")}
      </h2>
      <div className="overflow-hidden rounded-lg border border-line">
        <table className="w-full border-collapse text-left text-body">
          <thead>
            <tr className="border-b border-line text-label text-ink-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">
                {t("recent.name")}
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                {t("recent.location")}
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                {t("recent.opened")}
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                {t("recent.pages")}
              </th>
              <th scope="col" className="w-14 px-4 py-2.5">
                <span className="sr-only">{t("recent.actionsHeader")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={file.path}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-sunken"
                onClick={() => {
                  onOpen(file.path);
                }}
              >
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    title={file.path}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 border-0 bg-transparent p-0 text-left text-body font-semibold",
                      file.exists ? "text-ink" : "text-ink-muted",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(file.path);
                    }}
                  >
                    <FileText
                      size={16}
                      strokeWidth={1.75}
                      aria-hidden
                      className="flex-none text-danger"
                    />
                    {file.fileName}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-ink-muted">
                  {file.exists ? folderLabel(file.path) : t("recent.missing")}
                </td>
                <td className="px-4 py-2.5 text-ink-muted tabular-nums">
                  {opened(file.lastOpenedMs)}
                </td>
                <td className="px-4 py-2.5 text-ink-muted tabular-nums">{file.pageCount}</td>
                <td
                  className="px-4 py-1.5 text-right"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Menu
                    align="end"
                    trigger={
                      <button
                        type="button"
                        aria-label={t("recent.actions", { name: file.fileName })}
                        className="inline-grid size-control-sm cursor-pointer place-items-center rounded-md border-0 bg-transparent text-ink-muted hover:bg-surface hover:text-ink"
                      >
                        <MoreHorizontal size={16} strokeWidth={1.75} aria-hidden />
                      </button>
                    }
                  >
                    <MenuItem
                      onSelect={() => {
                        onRemove(file.path);
                      }}
                    >
                      {t("recent.remove")}
                    </MenuItem>
                  </Menu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

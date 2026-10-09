import { FileUp, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Kbd } from "@/components/ui/Kbd";
import { cn } from "@/lib/cn";
import { ThemeSwitcher } from "./ThemeSwitcher";

export interface HomeProps {
  onOpenFile: () => void;
  /** Files are being dragged over the window. */
  dragging: boolean;
  opening: boolean;
}

/** The home screen shown when no document is open. Recent files arrive in task 1.12. */
export function Home({ onOpenFile, dragging, opening }: HomeProps) {
  return (
    <div className="flex h-full justify-center overflow-auto bg-surface px-8 pt-12 pb-8">
      <div className="flex w-full max-w-[1040px] flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 font-display text-display font-medium tracking-[-0.015em] text-ink">
              Every page, in good light
            </h1>
            <p className="m-0 text-body text-ink-muted">
              Every feature is free. Your files open and stay on this device, no account needed.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSwitcher />
            <Button variant="primary" onClick={onOpenFile} disabled={opening}>
              <FolderOpen size={16} strokeWidth={1.75} aria-hidden />
              Open file
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
            {opening ? "Opening…" : "Drop a PDF here"}
          </span>
          <span className="text-label text-ink-muted">
            Or press <Kbd>Ctrl+O</Kbd> to browse.
          </span>
        </button>
      </div>
    </div>
  );
}

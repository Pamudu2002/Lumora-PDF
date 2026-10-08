import { X } from "lucide-react";
import { useEffect } from "react";
import { IconButton } from "@/components/ui/IconButton";
import type { OpenDocument } from "@/lib/ipc";
import { useDevicePixelRatio } from "@/lib/useDevicePixelRatio";
import { useDocumentsStore } from "@/stores/documents";
import { useViewerStore } from "@/stores/viewer";
import { PageView } from "./PageView";
import { ZoomBar } from "./ZoomBar";

export interface ViewerProps {
  doc: OpenDocument;
}

/** The document view. Phase 0 shows page 1; continuous scrolling arrives in task 1.1. */
export function Viewer({ doc }: ViewerProps) {
  const zoom = useViewerStore((s) => s.zoom);
  const close = useDocumentsStore((s) => s.close);
  const dpr = useDevicePixelRatio();
  useZoomShortcuts();

  const firstPage = doc.pageSizes[0];
  const title = doc.info.title ?? doc.fileName;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-toolbar flex-none items-center gap-2 border-b border-line bg-surface px-3">
        <h1 className="m-0 min-w-0 flex-1 truncate text-body font-semibold" title={doc.path}>
          {title}
        </h1>
        <IconButton
          label="Close file"
          shortcut="Ctrl+W"
          icon={<X size={18} strokeWidth={1.75} />}
          onClick={() => void close()}
        />
      </header>
      <main aria-label="Document" className="relative min-h-0 flex-1 bg-canvas">
        <div className="absolute inset-0 overflow-auto">
          <div className="flex min-h-full min-w-full w-max justify-center p-4 pb-20">
            {firstPage ? (
              <PageView
                docId={doc.id}
                page={0}
                size={firstPage}
                revision={doc.revision}
                zoom={zoom}
                devicePixelRatio={dpr}
              />
            ) : (
              <p className="m-auto text-caption text-ink-muted">This document has no pages.</p>
            )}
          </div>
        </div>
        <ZoomBar pageCount={doc.info.pageCount} />
      </main>
    </div>
  );
}

/** Ctrl+= / Ctrl++ zoom in, Ctrl+- zoom out, Ctrl+0 actual size, Ctrl+W close. */
function useZoomShortcuts() {
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const resetZoom = useViewerStore((s) => s.resetZoom);
  const close = useDocumentsStore((s) => s.close);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const actions: Record<string, () => void> = {
        "=": zoomIn,
        "+": zoomIn,
        "-": zoomOut,
        "0": resetZoom,
        w: () => void close(),
      };
      const action = actions[e.key.toLowerCase()];
      if (action) {
        e.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomIn, zoomOut, resetZoom, close]);
}

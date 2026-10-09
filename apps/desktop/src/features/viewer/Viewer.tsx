import { useEffect } from "react";
import { Sidebar } from "@/features/sidebar/Sidebar";
import type { OpenDocument } from "@/lib/ipc";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { useViewerStore } from "@/stores/viewer";
import { DocumentView } from "./DocumentView";
import { MainToolbar } from "./MainToolbar";
import { ViewToolbar } from "./ViewToolbar";
import { ZoomBar } from "./ZoomBar";

export interface ViewerProps {
  doc: OpenDocument;
}

/** The document screen: toolbars, sidebar, canvas with pages and the floating zoom bar. */
export function Viewer({ doc }: ViewerProps) {
  const init = useViewerStore((s) => s.init);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  useEffect(() => {
    init(doc.id);
  }, [doc.id, init]);
  useViewerShortcuts(doc.id);

  return (
    <div className="flex h-full flex-col">
      <MainToolbar doc={doc} />
      <ViewToolbar docId={doc.id} />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? <Sidebar doc={doc} /> : null}
        <main className="relative min-w-0 flex-1">
          <DocumentView doc={doc} dark={false} />
          <ZoomBar docId={doc.id} pageCount={doc.info.pageCount} />
        </main>
      </div>
    </div>
  );
}

/** Ctrl+= / Ctrl++ zoom in, Ctrl+- zoom out, Ctrl+0 actual size, Ctrl+1 fit page, Ctrl+2 fit
 * width, Ctrl+Shift+= / Ctrl+Shift+- rotate the view, Ctrl+W close, F4 sidebar. */
function useViewerShortcuts(docId: number) {
  const zoomStep = useViewerStore((s) => s.zoomStep);
  const setZoom = useViewerStore((s) => s.setZoom);
  const setZoomMode = useViewerStore((s) => s.setZoomMode);
  const rotate = useViewerStore((s) => s.rotate);
  const close = useDocumentsStore((s) => s.close);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F4" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        toggleSidebar();
        return;
      }
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      // Ctrl+Shift+= / Ctrl+Shift+- rotate the view (as in other PDF readers).
      if (e.shiftKey && (e.code === "Equal" || e.code === "Minus")) {
        e.preventDefault();
        rotate(docId, e.code === "Equal" ? 1 : -1);
        return;
      }
      const actions: Record<string, () => void> = {
        "=": () => {
          zoomStep(docId, 1);
        },
        "+": () => {
          zoomStep(docId, 1);
        },
        "-": () => {
          zoomStep(docId, -1);
        },
        "0": () => {
          setZoom(docId, 1);
        },
        "1": () => {
          setZoomMode(docId, "fitPage");
        },
        "2": () => {
          setZoomMode(docId, "fitWidth");
        },
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
  }, [docId, zoomStep, setZoom, setZoomMode, rotate, close, toggleSidebar]);
}

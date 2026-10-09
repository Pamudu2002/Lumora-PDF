import { useEffect } from "react";
import { Sidebar } from "@/features/sidebar/Sidebar";
import type { OpenDocument } from "@/lib/ipc";
import { rememberView, useDocumentsStore } from "@/stores/documents";
import { useSearchStore } from "@/stores/search";
import { useUiStore } from "@/stores/ui";
import { DEFAULT_VIEW, useDocView, useViewerStore } from "@/stores/viewer";
import { DocumentView } from "./DocumentView";
import { ExternalLinkDialog } from "./ExternalLinkDialog";
import { FindBar } from "./FindBar";
import { isWidgetKeyTarget } from "./focus";
import { stepPage } from "./layout";
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
  usePageKeys(doc.id, doc.info.pageCount);
  useFind(doc.id);
  useRememberView(doc);
  const findOpen = useSearchStore((s) => s.findOpen);

  return (
    <div className="flex h-full flex-col">
      <MainToolbar doc={doc} />
      <ViewToolbar docId={doc.id} />
      <div className="flex min-h-0 flex-1">
        {sidebarOpen ? <Sidebar doc={doc} /> : null}
        <main className="relative min-w-0 flex-1">
          <DocumentView doc={doc} dark={false} />
          <ZoomBar docId={doc.id} pageCount={doc.info.pageCount} />
          {findOpen ? <FindBar docId={doc.id} /> : null}
          <ExternalLinkDialog />
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
        w: () => void close(docId),
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

/**
 * Page navigation keys: PageUp / PageDown go to the previous / next page (a spread in two-page
 * layouts), Home / End to the first / last page. In single-page and two-page layouts the left
 * and right arrows turn pages too. Keys typed into fields, menus and lists are left alone.
 */
function usePageKeys(docId: number, pageCount: number) {
  const goToPage = useViewerStore((s) => s.goToPage);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.shiftKey || e.metaKey || pageCount === 0) return;
      if (e.defaultPrevented || isWidgetKeyTarget(e.target)) return;
      const view = useViewerStore.getState().views[docId] ?? DEFAULT_VIEW;
      const step = (dir: 1 | -1) =>
        stepPage(pageCount, view.layout, view.coverPage, view.currentPage, dir);
      const paged = view.layout !== "continuous";
      let target: number | null = null;
      if (e.key === "Home") target = 0;
      else if (e.key === "End") target = pageCount - 1;
      else if (e.ctrlKey) return;
      else if (e.key === "PageDown" || (paged && e.key === "ArrowRight")) target = step(1);
      else if (e.key === "PageUp" || (paged && e.key === "ArrowLeft")) target = step(-1);
      if (target === null) return;
      e.preventDefault();
      if (target !== view.currentPage || e.key === "Home" || e.key === "End") {
        goToPage(docId, target);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [docId, pageCount, goToPage]);
}

/**
 * Find: Ctrl+F opens the find bar, F3 / Shift+F3 go to the next / previous match, and the view
 * scrolls to each match as it becomes current. The search is cleared when the document closes.
 */
function useFind(docId: number) {
  const openFind = useSearchStore((s) => s.openFind);
  const step = useSearchStore((s) => s.step);
  const goToPage = useViewerStore((s) => s.goToPage);
  const activeNonce = useSearchStore((s) => s.searches[docId]?.activeNonce ?? 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        openFind();
      } else if (e.key === "F3" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        const page = useViewerStore.getState().views[docId]?.currentPage ?? 0;
        if (useSearchStore.getState().searches[docId]) step(docId, e.shiftKey ? -1 : 1, page);
        else openFind();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [docId, openFind, step]);

  useEffect(() => {
    const hit = useSearchStore.getState().searches[docId]?.active;
    const rect = hit?.rects[0];
    if (!hit || activeNonce === 0) return;
    goToPage(
      docId,
      hit.page,
      rect ? { x: rect.x + rect.width / 2, y: rect.y, ifHidden: true } : undefined,
    );
  }, [docId, activeNonce, goToPage]);
}

/** How long the page and zoom must stay put before they are saved for next time. */
const REMEMBER_DELAY_MS = 1000;

/** Saves the page and zoom shortly after they change, so the file reopens where it was left. */
function useRememberView(doc: OpenDocument) {
  const { currentPage, zoom, zoomMode } = useDocView(doc.id);
  useEffect(() => {
    const timer = setTimeout(() => {
      rememberView(doc);
    }, REMEMBER_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [doc, currentPage, zoom, zoomMode]);
}

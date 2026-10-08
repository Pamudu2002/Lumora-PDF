import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import { useDocumentsStore } from "@/stores/documents";

/** True for paths ending in .pdf (any case). */
export function isPdfPath(path: string): boolean {
  return /\.pdf$/i.test(path);
}

/** Shows the native open dialog and opens the chosen PDF. */
export function useOpenFileDialog(): () => Promise<void> {
  const openDocument = useDocumentsStore((s) => s.open);
  return useCallback(async () => {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "PDF documents", extensions: ["pdf"] }],
    });
    if (typeof path === "string") {
      await openDocument(path);
    }
  }, [openDocument]);
}

/** Ctrl+O opens the file dialog from anywhere. */
export function useOpenShortcut(openFileDialog: () => Promise<void>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        void openFileDialog();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [openFileDialog]);
}

/**
 * Opens a PDF dropped anywhere on the window (Tauri delivers file paths through the webview's
 * drag-and-drop event). Returns true while files are dragged over the window.
 */
export function useFileDrop(): boolean {
  const openDocument = useDocumentsStore((s) => s.open);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;
    getCurrentWebview()
      .onDragDropEvent((event) => {
        const { payload } = event;
        if (payload.type === "enter" || payload.type === "over") {
          setDragging(true);
        } else if (payload.type === "leave") {
          setDragging(false);
        } else {
          setDragging(false);
          // Merging several files arrives in task 3.5; for now open the first PDF.
          const pdf = payload.paths.find(isPdfPath);
          if (pdf) void openDocument(pdf);
        }
      })
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openDocument]);

  return dragging;
}

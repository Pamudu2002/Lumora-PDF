import { useEffect } from "react";
import { onOpenFiles, takeStartupFiles } from "@/lib/ipc";
import { useDocumentsStore } from "@/stores/documents";

/**
 * Opens the PDFs Lumora was started with ("Open with", double-click) and those another launch
 * passes to this window, each in its own tab.
 */
export function useOsFileOpening() {
  const open = useDocumentsStore((s) => s.open);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const openAll = async (paths: string[]) => {
      for (const path of paths) await open(path);
    };
    // The Rust side hands the startup files out once, so open them even if this effect has been
    // cleaned up meanwhile (React runs effects twice in development).
    takeStartupFiles()
      .then(openAll)
      .catch(() => undefined);
    onOpenFiles((paths) => void openAll(paths))
      .then((fn) => {
        if (disposed) fn();
        else unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [open]);
}

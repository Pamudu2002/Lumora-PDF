import { useEffect } from "react";
import { useDocumentsStore } from "@/stores/documents";
import { usePrintStore } from "@/stores/print";

/**
 * Ctrl+P opens Lumora's print dialog for the active document. It is always intercepted, so the
 * WebView never prints the app's own interface.
 */
export function usePrintShortcut() {
  const show = usePrintStore((s) => s.show);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "p") {
        return;
      }
      e.preventDefault();
      if (useDocumentsStore.getState().activeId !== null) show();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);
}

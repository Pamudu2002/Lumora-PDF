import { useEffect } from "react";
import { useDialogStore } from "@/stores/dialogs";

/** Ctrl+, opens Settings from anywhere. */
export function useSettingsShortcut() {
  const show = useDialogStore((s) => s.show);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key === ",") {
        e.preventDefault();
        show("settings");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [show]);
}
